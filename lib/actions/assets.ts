"use server";

import { and, eq, or } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db/client";
import { toEditorAsset } from "@/lib/db/queries/assets";
import { assetVariant, assets } from "@/lib/db/schema";
import type { AssetRow } from "@/lib/db/schema";
import type { EditorAsset } from "@/lib/editor/store";
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

// An identical file, or the same derived image of the same source
const findReusable = async ({
  sha256,
  source,
}: CreateUploadInput): Promise<AssetRow | undefined> => {
  if (!sha256 && !source) {
    return;
  }
  const [row] = await getDb()
    .select()
    .from(assets)
    .where(
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

  const existing = await findReusable(data);
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
    const winner = await findReusable(data);
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

// Step 3 of 3: verify the object actually landed (presigned PUTs can't
// enforce size) and mark the asset ready.
export const confirmUpload = async (id: string): Promise<EditorAsset> => {
  const assetId = z.uuid().parse(id);
  const db = getDb();
  const [row] = await db
    .select()
    .from(assets)
    .where(eq(assets.id, assetId))
    .limit(1);
  if (!row) {
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
