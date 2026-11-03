import { after } from "next/server";
import { z } from "zod";

import { getViewer } from "@/lib/auth/server";
import { getDb } from "@/lib/db/client";
import { changesStatement } from "@/lib/db/queries/changes";
import { isDesignId } from "@/lib/db/queries/designs";
import { finishSnapshot } from "@/lib/db/queries/versions";
import {
  MAX_CANVAS_SIZE,
  MAX_ELEMENTS,
  MAX_ELEMENT_JSON_LENGTH,
  MIN_CANVAS_SIZE,
  backgroundSchema,
  elementSchema,
  keepUnknownFields,
} from "@/lib/document/schema";

// Fractional-index keys are base-62 digits
const POSITION_KEY = /^[0-9A-Za-z]{2,200}$/u;

const canvasSize = z.number().int().min(MIN_CANVAS_SIZE).max(MAX_CANVAS_SIZE);

// Validated like any element, but stored with the fields this version
// doesn't know yet, so a newer editor's additions survive an older one
const elementData = z
  .unknown()
  .refine(
    (raw) => (JSON.stringify(raw) ?? "").length <= MAX_ELEMENT_JSON_LENGTH,
    {
      message: "Element too large",
    }
  )
  .transform((raw, context) => {
    const parsed = elementSchema.safeParse(raw);
    if (!parsed.success) {
      context.addIssue({
        code: "custom",
        message: z.prettifyError(parsed.error),
      });
      return z.NEVER;
    }
    return keepUnknownFields(raw, parsed.data);
  });

const changesPayload = z.object({
  clientId: z.uuid(),
  deletes: z.array(z.string().min(1).max(64)).max(MAX_ELEMENTS),
  elements: z
    .array(
      z.object({
        data: elementData,
        mode: z.enum(["create", "update"]),
        position: z.string().regex(POSITION_KEY),
      })
    )
    .max(MAX_ELEMENTS),
  name: z.string().trim().min(1).max(120).optional(),
  page: z
    .object({
      background: backgroundSchema,
      height: canvasSize,
      width: canvasSize,
    })
    .optional(),
});

const json = (body: unknown, status = 200) => Response.json(body, { status });

// Saves a batch of element writes, deletes and page settings in one
// statement, so it's one transaction whose id the client waits for on the
// live query. Creates upsert; updates only touch rows that still exist, so
// an element someone deleted stays deleted. A Route Handler rather than a
// Server Action because actions run one at a time per client, and it doubles
// as the keepalive target when the tab closes. changesStatement says how
// access and version history are handled inside the statement; pruning old
// versions waits until after the response.
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
  const { clientId, deletes, elements, name, page } = parsed.data;
  const result = await getDb().execute<{
    found: number;
    snapshot_id: string | null;
    txid: string;
  }>(
    changesStatement({
      clientId,
      deletes,
      designId: id,
      name: name ?? null,
      page: page ?? null,
      viewer,
      writes: elements,
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
