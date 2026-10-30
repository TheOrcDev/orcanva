import { createHash } from "node:crypto";

import { and, eq } from "drizzle-orm";
import { z } from "zod";

import { removeBackground } from "@/lib/background-removal/remove-background";
import { getDb } from "@/lib/db/client";
import { toEditorAsset } from "@/lib/db/queries/assets";
import { assets } from "@/lib/db/schema";
import type { AssetRow } from "@/lib/db/schema";
import { assetKey } from "@/lib/storage/keys";
import { getObject, putObject } from "@/lib/storage/s3";

// First use downloads the model; give it room on platforms that cap time
export const maxDuration = 300;

const VARIANT = "no-background";
const NAME_SUFFIX = " (no bg)";

const json = (body: unknown, status = 200) => Response.json(body, { status });

const findCutout = async (sourceId: string): Promise<AssetRow | undefined> => {
  const [row] = await getDb()
    .select()
    .from(assets)
    .where(and(eq(assets.sourceAssetId, sourceId), eq(assets.variant, VARIANT)))
    .limit(1);
  return row;
};

// Cuts the subject out of an uploaded image and stores the transparent PNG
// as a new library asset linked to its source. Repeat requests for the same
// image return the stored cutout instead of running the model again.
export const POST = async (
  _request: Request,
  context: RouteContext<"/api/assets/[id]/remove-background">
): Promise<Response> => {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return json({ error: "Not found" }, 404);
  }

  const db = getDb();
  const [source] = await db
    .select()
    .from(assets)
    .where(eq(assets.id, id))
    .limit(1);
  if (source?.status !== "ready") {
    return json({ error: "Image not found" }, 404);
  }
  if (source.variant === VARIANT) {
    return json(toEditorAsset(source));
  }

  const existing = await findCutout(source.id);
  if (existing) {
    return json(toEditorAsset(existing));
  }

  const object = await getObject(source.key);
  const bytes = await object.Body?.transformToByteArray();
  if (!bytes) {
    return json({ error: "Image file is missing" }, 404);
  }

  let cutout: Awaited<ReturnType<typeof removeBackground>>;
  try {
    cutout = await removeBackground(bytes);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return json({ error: `Background removal failed: ${message}` }, 500);
  }
  const cutoutId = crypto.randomUUID();
  const key = assetKey(cutoutId, "image/png");
  await putObject(key, cutout.png, "image/png");

  const [created] = await db
    .insert(assets)
    .values({
      height: cutout.height,
      id: cutoutId,
      key,
      mimeType: "image/png",
      originalName: `${source.originalName.slice(0, 200 - NAME_SUFFIX.length)}${NAME_SUFFIX}`,
      sha256: createHash("sha256").update(cutout.png).digest("hex"),
      sizeBytes: cutout.png.byteLength,
      sourceAssetId: source.id,
      status: "ready",
      variant: VARIANT,
      width: cutout.width,
    })
    // A concurrent request for the same image may have won the race
    .onConflictDoNothing()
    .returning();

  const result = created ?? (await findCutout(source.id));
  if (!result) {
    return json({ error: "Could not save the cutout" }, 500);
  }
  return json(toEditorAsset(result));
};
