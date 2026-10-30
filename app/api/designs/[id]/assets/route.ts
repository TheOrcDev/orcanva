import { z } from "zod";

import { findReadyAssets } from "@/lib/db/queries/assets";
import { isDesignId } from "@/lib/db/queries/designs";
import { MAX_ASSET_LOOKUP } from "@/lib/editor/asset-resolver";

const lookupIds = z.array(z.uuid()).min(1).max(MAX_ASSET_LOOKUP);

const json = (body: unknown, status = 200) => Response.json(body, { status });

// Assets an open editor hasn't seen yet: images a collaborator uploaded
// after it loaded, or pasted from another design (and their originals)
export const GET = async (
  request: Request,
  context: RouteContext<"/api/designs/[id]/assets">
): Promise<Response> => {
  const { id } = await context.params;
  if (!isDesignId(id)) {
    return json({ error: "Not found" }, 404);
  }

  const ids = lookupIds.safeParse(
    new URL(request.url).searchParams.get("ids")?.split(",") ?? []
  );
  if (!ids.success) {
    return json({ error: "Invalid asset ids" }, 422);
  }
  return json({ assets: await findReadyAssets(ids.data) });
};
