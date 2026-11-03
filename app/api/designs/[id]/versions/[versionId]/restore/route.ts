import { after } from "next/server";
import { z } from "zod";

import { getViewer } from "@/lib/auth/server";
import { isDesignId } from "@/lib/db/queries/designs";
import { finishSnapshot, restoreVersion } from "@/lib/db/queries/versions";

const restorePayload = z.object({ clientId: z.uuid() });

const versionId = z.uuid();

const NO_STORE = { "Cache-Control": "private, no-store" };

const json = (body: unknown, status = 200) =>
  Response.json(body, { headers: NO_STORE, status });

// Puts the design back to a version, for everyone on it (see
// restoreVersion). The editor sends its own edits first and then waits for
// `txid` on the live queries. Owner and people it's shared with only;
// everyone else gets a 404.
export const POST = async (
  request: Request,
  context: RouteContext<"/api/designs/[id]/versions/[versionId]/restore">
): Promise<Response> => {
  const { id, versionId: rawVersionId } = await context.params;
  const version = versionId.safeParse(rawVersionId);
  const viewer = await getViewer();
  if (!(viewer && isDesignId(id) && version.success)) {
    return json({ error: "Not found" }, 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const parsed = restorePayload.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Invalid restore" }, 422);
  }

  const outcome = await restoreVersion({
    clientId: parsed.data.clientId,
    designId: id,
    versionId: version.data,
    viewer,
  });
  if (outcome.status === "not-found") {
    return json({ error: "Not found" }, 404);
  }
  if (outcome.status === "outdated") {
    return json(
      {
        error:
          "This version was saved by another version of Orcanva, so it can't be restored here.",
      },
      409
    );
  }
  // The restore version's picture and pruning, as for any snapshot
  const { restoreVersionId } = outcome;
  after(() => finishSnapshot(id, restoreVersionId));
  return json({ restoreVersionId, txid: outcome.txid });
};
