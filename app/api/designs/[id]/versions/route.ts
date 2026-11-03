import { z } from "zod";

import { canManageHistory } from "@/lib/auth/access";
import { getDesignAccess } from "@/lib/auth/design-access";
import { getViewer } from "@/lib/auth/server";
import { isDesignId } from "@/lib/db/queries/designs";
import { listVersions, saveNamedVersion } from "@/lib/db/queries/versions";
import { MAX_NAMED_VERSIONS, MAX_VERSION_NAME } from "@/lib/versions/schema";

const NO_STORE = { "Cache-Control": "private, no-store" };

const json = (body: unknown, status = 200) =>
  Response.json(body, { headers: NO_STORE, status });

const savePayload = z.object({
  name: z.string().trim().min(1).max(MAX_VERSION_NAME),
});

// Version history is for the owner and people it's shared with. Everyone
// else gets a 404, public editors and guests included, as if there were
// none: old versions can hold what the owner removed on purpose. Route
// Handlers rather than Server Actions, so they don't queue behind uploads.

// One page of versions, newest first; ?before=<ISO time> for older ones
export const GET = async (
  request: Request,
  context: RouteContext<"/api/designs/[id]/versions">
): Promise<Response> => {
  const { id } = await context.params;
  const { role } = await getDesignAccess(id);
  if (!(role && canManageHistory(role))) {
    return json({ error: "Not found" }, 404);
  }
  const before = new URL(request.url).searchParams.get("before");
  const cursor = before ? new Date(before) : null;
  if (cursor && Number.isNaN(cursor.getTime())) {
    return json({ error: "Invalid cursor" }, 422);
  }
  return json(await listVersions(id, cursor));
};

// Saves the design as it is now under a name. The editor sends its own
// pending edits first, so the version holds them.
export const POST = async (
  request: Request,
  context: RouteContext<"/api/designs/[id]/versions">
): Promise<Response> => {
  const { id } = await context.params;
  const viewer = await getViewer();
  if (!(viewer && isDesignId(id))) {
    return json({ error: "Not found" }, 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const parsed = savePayload.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Invalid name" }, 422);
  }

  const saved = await saveNamedVersion({
    designId: id,
    name: parsed.data.name,
    viewer,
  });
  if (!saved) {
    return json({ error: "Not found" }, 404);
  }
  if (!saved.id) {
    return json(
      {
        error: `This design already has ${MAX_NAMED_VERSIONS} saved versions. Delete one to save another.`,
      },
      409
    );
  }
  return json({ id: saved.id }, 201);
};
