"use server";

import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db/client";
import { toEditorAsset } from "@/lib/db/queries/assets";
import { assets } from "@/lib/db/schema";
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
  sha256: z.string().regex(/^[0-9a-f]{64}$/u),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES),
  width: z.number().int().positive().max(16_384),
});

export type CreateUploadResult =
  | { status: "exists"; asset: EditorAsset }
  | { status: "upload"; assetId: string; uploadUrl: string };

// Step 1 of 3: reserve an asset (or reuse an identical one) and hand the
// browser a short-lived presigned PUT so the file never transits Next.js.
export const createUpload = async (
  input: z.input<typeof createUploadInput>
): Promise<CreateUploadResult> => {
  const data = createUploadInput.parse(input);
  const db = getDb();

  const [existing] = await db
    .select()
    .from(assets)
    .where(eq(assets.sha256, data.sha256))
    .limit(1);
  if (existing?.status === "ready") {
    return { asset: toEditorAsset(existing), status: "exists" };
  }
  if (existing) {
    // A previous attempt never finished; let this one complete it
    return {
      assetId: existing.id,
      status: "upload",
      uploadUrl: await createPresignedPut(existing.key, existing.mimeType),
    };
  }

  const id = crypto.randomUUID();
  const key = assetKey(id, data.mimeType);
  await db.insert(assets).values({
    height: data.height,
    id,
    key,
    mimeType: data.mimeType,
    originalName: data.originalName,
    sha256: data.sha256,
    sizeBytes: data.size,
    width: data.width,
  });
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
