import { storageCacheTag } from "@/lib/storage/cdn";
import { isServableKey } from "@/lib/storage/keys";
import { IMMUTABLE_CACHE_CONTROL, getObject } from "@/lib/storage/s3";

// Same-origin proxy for bucket objects: keeps the bucket private and means
// canvas exports never get tainted by cross-origin images.
export const GET = async (
  _request: Request,
  context: RouteContext<"/api/storage/[...key]">
): Promise<Response> => {
  const { key: segments } = await context.params;
  const key = segments.join("/");

  if (!isServableKey(key)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const object = await getObject(key);
    if (!object.Body) {
      return new Response("Not found", { status: 404 });
    }
    const headers = new Headers({
      "Cache-Control": IMMUTABLE_CACHE_CONTROL,
      "Content-Type": object.ContentType ?? "application/octet-stream",
    });
    if (object.ContentLength !== undefined) {
      headers.set("Content-Length", String(object.ContentLength));
    }
    if (object.ETag) {
      headers.set("ETag", object.ETag);
    }
    // So deleting the file can drop the CDN's copy (lib/storage/cdn.ts)
    const tag = storageCacheTag(key);
    if (tag) {
      headers.set("Vercel-Cache-Tag", tag);
    }
    return new Response(object.Body.transformToWebStream(), { headers });
  } catch (error) {
    if (error instanceof Error && error.name === "NoSuchKey") {
      return new Response("Not found", { status: 404 });
    }
    throw error;
  }
};
