import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db/client";
import { assets } from "@/lib/db/schema";
import { MAX_UPLOAD_BYTES } from "@/lib/storage/keys";
import { putObject } from "@/lib/storage/s3";

const text = (body: string, status: number) => new Response(body, { status });

// Fallback upload path: when the browser can't PUT straight to the bucket
// (CORS not set for this origin, blocked network), the file comes through
// the app instead. Only reserved, still-pending assets are accepted.
export const PUT = async (
  request: Request,
  context: RouteContext<"/api/assets/[id]/file">
): Promise<Response> => {
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) {
    return text("Not found", 404);
  }

  const [asset] = await getDb()
    .select()
    .from(assets)
    .where(eq(assets.id, id))
    .limit(1);
  if (!asset) {
    return text("Not found", 404);
  }
  if (asset.status === "ready") {
    return new Response(null, { status: 204 });
  }
  if (request.headers.get("content-type") !== asset.mimeType) {
    return text(`Expected ${asset.mimeType}`, 415);
  }

  const body = new Uint8Array(await request.arrayBuffer());
  if (body.byteLength === 0 || body.byteLength > MAX_UPLOAD_BYTES) {
    return text("File size out of range", 413);
  }

  await putObject(asset.key, body, asset.mimeType);
  return new Response(null, { status: 204 });
};
