"use server";

import { and, eq, inArray, or } from "drizzle-orm";
import { z } from "zod";

import { isReusableVariant } from "@/lib/assets/variants";
import { getDesignAccess } from "@/lib/auth/design-access";
import { getViewer, requireViewer } from "@/lib/auth/server";
import { getDb } from "@/lib/db/client";
import { findImageFamily, toEditorAsset } from "@/lib/db/queries/assets";
import { assetVariant, assets } from "@/lib/db/schema";
import type { AssetRow } from "@/lib/db/schema";
import type { EditorAsset } from "@/lib/editor/store";
import { purgeStorageCache } from "@/lib/storage/cdn";
import {
  MAX_UPLOAD_BYTES,
  UPLOAD_MIME_TYPES,
  assetKey,
} from "@/lib/storage/keys";
import type { UploadMimeType } from "@/lib/storage/keys";
import { createPresignedPut, deleteObject, headObject } from "@/lib/storage/s3";

const mimeTypes = Object.keys(UPLOAD_MIME_TYPES) as [
  UploadMimeType,
  ...UploadMimeType[],
];

const createUploadInput = z.object({
  // The design being edited: uploading needs permission to edit it
  designId: z.uuid(),
  height: z.number().int().positive().max(16_384),
  mimeType: z.enum(mimeTypes),
  originalName: z.string().trim().min(1).max(200),
  sha256: z
    .string()
    .regex(/^[0-9a-f]{64}$/u)
    .nullable(),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  // Set for a derived image (e.g. a background-removed cutout of `assetId`)
  source: z
    .object({ assetId: z.uuid(), variant: z.enum(assetVariant.enumValues) })
    .optional(),
  width: z.number().int().positive().max(16_384),
});

type CreateUploadInput = z.output<typeof createUploadInput>;
export type CreateUploadSource = NonNullable<CreateUploadInput["source"]>;

export type CreateUploadResult =
  | { status: "exists"; asset: EditorAsset }
  | { status: "upload"; assetId: string; uploadUrl: string };

// An identical file, or the same derived image of the same source, among
// the account's own uploads. Hashes and cutouts come from the browser
// unverified, so nobody else's upload ever stands in for yours; guests have
// no library and never reuse anything. Erases are only ever reused as
// identical files, since each depends on its own mask.
const findReusable = async (
  ownerId: string | null,
  { sha256, source: derived }: CreateUploadInput
): Promise<AssetRow | undefined> => {
  const source =
    derived && isReusableVariant(derived.variant) ? derived : undefined;
  if (!(ownerId && (sha256 || source))) {
    return;
  }
  const [row] = await getDb()
    .select()
    .from(assets)
    .where(
      and(
        eq(assets.ownerId, ownerId),
        or(
          sha256 ? eq(assets.sha256, sha256) : undefined,
          source
            ? and(
                eq(assets.sourceAssetId, source.assetId),
                eq(assets.variant, source.variant)
              )
            : undefined
        )
      )
    )
    .limit(1);
  return row;
};

const reuse = async (row: AssetRow): Promise<CreateUploadResult> => {
  if (row.status === "ready") {
    return { asset: toEditorAsset(row), status: "exists" };
  }
  // A previous attempt never finished; let this one complete it
  return {
    assetId: row.id,
    status: "upload",
    uploadUrl: await createPresignedPut(row.key, row.mimeType),
  };
};

// Step 1 of 3: reserve an asset (or reuse an identical one) and hand the
// browser a short-lived presigned PUT so the file never transits Next.js.
export const createUpload = async (
  input: z.input<typeof createUploadInput>
): Promise<CreateUploadResult> => {
  const data = createUploadInput.parse(input);
  const { role, viewer } = await getDesignAccess(data.designId);
  if (!role) {
    throw new Error("Design not found");
  }
  const ownerId = viewer?.id ?? null;

  const existing = await findReusable(ownerId, data);
  if (existing) {
    return reuse(existing);
  }

  const id = crypto.randomUUID();
  const key = assetKey(id, data.mimeType);
  const [created] = await getDb()
    .insert(assets)
    .values({
      height: data.height,
      id,
      key,
      mimeType: data.mimeType,
      originalName: data.originalName,
      ownerId,
      sha256: data.sha256,
      sizeBytes: data.size,
      sourceAssetId: data.source?.assetId,
      variant: data.source?.variant,
      width: data.width,
    })
    // A concurrent upload of the same file or cutout may have won the race
    .onConflictDoNothing()
    .returning({ id: assets.id });
  if (!created) {
    const winner = await findReusable(ownerId, data);
    if (!winner) {
      throw new Error("Could not reserve the upload");
    }
    return reuse(winner);
  }
  return {
    assetId: id,
    status: "upload",
    uploadUrl: await createPresignedPut(key, data.mimeType),
  };
};

const deleteImageInput = z.object({ assetId: z.uuid(), designId: z.uuid() });

// An admin's Delete for everyone, from a public design that shows the image
// (findImageFamily says which): its file and every copy in its family go for
// good, from every library and brand kit too. Other designs still showing
// one draw it as missing; the editor that asked takes it off its own pages.
// Files go first, then the rows: a row left behind lets the admin try again,
// a file left behind would stay reachable at its URL. Returns the ids.
export const deleteImageEverywhere = async (
  input: z.input<typeof deleteImageInput>
): Promise<string[]> => {
  const { assetId, designId } = deleteImageInput.parse(input);
  const viewer = await requireViewer();
  const family = await findImageFamily({
    assetId,
    designId,
    viewerId: viewer.id,
  });
  if (family.length === 0) {
    throw new Error("Image not found");
  }
  const keys = family.map((asset) => asset.key);
  await Promise.all(keys.map((key) => deleteObject(key)));
  await purgeStorageCache(keys);
  const ids = family.map((asset) => asset.id);
  await getDb().delete(assets).where(inArray(assets.id, ids));
  return ids;
};

// Step 3 of 3: verify the object actually landed (presigned PUTs can't
// enforce size) and mark the asset ready.
export const confirmUpload = async (id: string): Promise<EditorAsset> => {
  const assetId = z.uuid().parse(id);
  const viewer = await getViewer();
  const db = getDb();
  const [row] = await db
    .select()
    .from(assets)
    .where(eq(assets.id, assetId))
    .limit(1);
  // Only whoever reserved it (the id itself is the guest's proof)
  if (!row || row.ownerId !== (viewer?.id ?? null)) {
    throw new Error("Upload not found");
  }
  if (row.status === "ready") {
    return toEditorAsset(row);
  }

  const object = await headObject(row.key);
  if (!object) {
    throw new Error("Uploaded file is missing");
  }
  if (object.size > MAX_UPLOAD_BYTES) {
    await deleteObject(row.key);
    await db.delete(assets).where(eq(assets.id, assetId));
    throw new Error("Uploaded file is too large");
  }

  const [ready] = await db
    .update(assets)
    .set({ sizeBytes: object.size, status: "ready", updatedAt: new Date() })
    .where(eq(assets.id, assetId))
    .returning();
  if (!ready) {
    throw new Error("Upload not found");
  }
  return toEditorAsset(ready);
};
