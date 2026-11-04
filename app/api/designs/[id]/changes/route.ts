import { after } from "next/server";

import { getViewer } from "@/lib/auth/server";
import { getDb } from "@/lib/db/client";
import { changesStatement } from "@/lib/db/queries/changes";
import { isDesignId } from "@/lib/db/queries/designs";
import { finishSnapshot } from "@/lib/db/queries/versions";
import {
  changesPayload,
  changesWritesOf,
} from "@/lib/document/changes-payload";

const json = (body: unknown, status = 200) => Response.json(body, { status });

// Saves a batch of page and element writes and deletes, the size and the
// name in one statement, so it's one transaction whose id the client waits
// for on the live queries. Creates upsert; updates only touch rows that
// still exist, so an element or page someone deleted stays deleted. Tabs
// from before pages send their own shape (see changesPayload). A Route
// Handler rather than a Server Action because actions run one at a time per
// client, and it doubles as the keepalive target when the tab closes.
// changesStatement says how access, pages and version history are handled
// inside the statement; pruning old versions waits until after the
// response.
export const POST = async (
  request: Request,
  context: RouteContext<"/api/designs/[id]/changes">
): Promise<Response> => {
  const { id } = await context.params;
  if (!isDesignId(id)) {
    return json({ error: "Not found" }, 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const parsed = changesPayload.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Invalid changes", issues: parsed.error.issues }, 422);
  }

  const viewer = await getViewer();
  const result = await getDb().execute<{
    found: number;
    snapshot_id: string | null;
    txid: string;
  }>(
    changesStatement({
      ...changesWritesOf(parsed.data),
      clientId: parsed.data.clientId,
      designId: id,
      viewer,
    })
  );

  const [row] = result.rows;
  if (!row?.found) {
    return json({ error: "Not found" }, 404);
  }
  const snapshotId = row.snapshot_id;
  if (snapshotId) {
    after(() => finishSnapshot(id, snapshotId));
  }
  return json({ txid: row.txid });
};
