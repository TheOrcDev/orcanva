import { eq } from "drizzle-orm";

import { getDesignAccess } from "@/lib/auth/design-access";
import { getDb } from "@/lib/db/client";
import { designs } from "@/lib/db/schema";
import { thumbnailKey } from "@/lib/storage/keys";
import { deleteObject, putObject } from "@/lib/storage/s3";

// Thumbnails are ≤640px JPEGs; anything bigger is not from our renderer
const MAX_THUMBNAIL_BYTES = 512 * 1024;

const text = (body: string, status: number) => new Response(body, { status });

export const PUT = async (
  request: Request,
  context: RouteContext<"/api/designs/[id]/thumbnail">
): Promise<Response> => {
  const { id } = await context.params;
  // Any window editing the design renders its preview
  const { role } = await getDesignAccess(id);
  if (!role) {
    return text("Not found", 404);
  }
  if (request.headers.get("content-type") !== "image/jpeg") {
    return text("Thumbnail must be image/jpeg", 415);
  }

  const body = new Uint8Array(await request.arrayBuffer());
  if (body.byteLength === 0 || body.byteLength > MAX_THUMBNAIL_BYTES) {
    return text("Thumbnail size out of range", 413);
  }

  const db = getDb();
  const [current] = await db
    .select({ thumbnailKey: designs.thumbnailKey })
    .from(designs)
    .where(eq(designs.id, id))
    .limit(1);
  if (!current) {
    return text("Not found", 404);
  }

  // A fresh key: every thumbnail URL is immutable and safely cacheable
  const key = thumbnailKey(id);
  await putObject(key, body, "image/jpeg");
  await db.update(designs).set({ thumbnailKey: key }).where(eq(designs.id, id));

  if (current.thumbnailKey && current.thumbnailKey !== key) {
    await deleteObject(current.thumbnailKey).catch(() => null);
  }
  return Response.json({ key });
};
