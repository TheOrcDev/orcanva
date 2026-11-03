import { z } from "zod";

import { canManageHistory } from "@/lib/auth/access";
import { getDesignAccess } from "@/lib/auth/design-access";
import { setVersionThumbnail } from "@/lib/db/queries/versions";
import { storageUrl, versionThumbnailKey } from "@/lib/storage/keys";
import { deleteObject, putObject } from "@/lib/storage/s3";

// Thumbnails are ≤640px JPEGs; anything bigger is not from our renderer
const MAX_THUMBNAIL_BYTES = 512 * 1024;

const versionId = z.uuid();

const text = (body: string, status: number) => new Response(body, { status });

// A picture of a version, drawn by the editor: of a named version as it's
// saved, and of any version without one when it's first previewed. The
// first picture stays; a later one (another window previewing it at the
// same time) is thrown away.
export const PUT = async (
  request: Request,
  context: RouteContext<"/api/designs/[id]/versions/[versionId]/thumbnail">
): Promise<Response> => {
  const { id, versionId: rawVersionId } = await context.params;
  const { role } = await getDesignAccess(id);
  const version = versionId.safeParse(rawVersionId);
  if (!(role && canManageHistory(role) && version.success)) {
    return text("Not found", 404);
  }
  if (request.headers.get("content-type") !== "image/jpeg") {
    return text("Thumbnail must be image/jpeg", 415);
  }

  const body = new Uint8Array(await request.arrayBuffer());
  if (body.byteLength === 0 || body.byteLength > MAX_THUMBNAIL_BYTES) {
    return text("Thumbnail size out of range", 413);
  }

  const key = versionThumbnailKey(id);
  await putObject(key, body, "image/jpeg");
  if (!(await setVersionThumbnail(id, version.data, key))) {
    await deleteObject(key).catch(() => null);
    return text("This version already has a picture, or is gone", 409);
  }
  return Response.json({ url: storageUrl(key) });
};
