import { z } from "zod";

import { canManageHistory } from "@/lib/auth/access";
import { getDesignAccess } from "@/lib/auth/design-access";
import { findReadyAssets } from "@/lib/db/queries/assets";
import { deleteVersion, getVersion } from "@/lib/db/queries/versions";

const versionId = z.uuid();

const NO_STORE = { "Cache-Control": "private, no-store" };

const json = (body: unknown, status = 200) =>
  Response.json(body, { headers: NO_STORE, status });

// One version for the read-only preview: its page and element rows as
// stored, and the images it shows (with the originals behind cutouts, as
// the editor loads them). For the owner and people it's shared with; a 404
// for everyone else (see ../route.ts).
export const GET = async (
  _request: Request,
  context: RouteContext<"/api/designs/[id]/versions/[versionId]">
): Promise<Response> => {
  const { id, versionId: rawVersionId } = await context.params;
  const { role } = await getDesignAccess(id);
  const version = versionId.safeParse(rawVersionId);
  if (!(role && canManageHistory(role) && version.success)) {
    return json({ error: "Not found" }, 404);
  }
  const found = await getVersion(id, version.data);
  if (!found) {
    return json({ error: "Not found" }, 404);
  }
  const { assetIds } = found.content;
  const assets = assetIds.length > 0 ? await findReadyAssets(assetIds) : [];
  return json({ assets, content: found.content, version: found.summary });
};

// Only the owner deletes versions
export const DELETE = async (
  _request: Request,
  context: RouteContext<"/api/designs/[id]/versions/[versionId]">
): Promise<Response> => {
  const { id, versionId: rawVersionId } = await context.params;
  const { role } = await getDesignAccess(id);
  const version = versionId.safeParse(rawVersionId);
  if (!(role === "owner" && version.success)) {
    return json({ error: "Not found" }, 404);
  }
  if (!(await deleteVersion(id, version.data))) {
    return json({ error: "Not found" }, 404);
  }
  return new Response(null, { headers: NO_STORE, status: 204 });
};
