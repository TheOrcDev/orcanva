import { sql } from "drizzle-orm";
import { z } from "zod";

import { getViewer } from "@/lib/auth/server";
import { getDb } from "@/lib/db/client";
import { isDesignId } from "@/lib/db/queries/designs";
import {
  MAX_CANVAS_SIZE,
  MAX_ELEMENTS,
  MIN_CANVAS_SIZE,
  backgroundSchema,
  elementSchema,
} from "@/lib/document/schema";

// Fractional-index keys are base-62 digits
const POSITION_KEY = /^[0-9A-Za-z]{2,200}$/u;

const canvasSize = z.number().int().min(MIN_CANVAS_SIZE).max(MAX_CANVAS_SIZE);

const changesPayload = z.object({
  clientId: z.uuid(),
  deletes: z.array(z.string().min(1).max(64)).max(MAX_ELEMENTS),
  elements: z
    .array(
      z.object({
        data: elementSchema,
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
// as the keepalive target when the tab closes.
//
// Access is checked inside the statement: the design row is only updated
// (and locked) when the viewer may edit it, and every element write joins
// that row. Postgres runs every data-modifying CTE whether or not anything
// reads it, so a write that didn't join `design` would bypass the check.
// Only the owner's name changes stick; others' are ignored rather than
// refused, since a refusal would drop the element writes batched with it.
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
  const viewerId = viewer?.id ?? null;
  const { clientId, deletes, elements, name, page } = parsed.data;
  const writes = JSON.stringify(
    elements.map(({ data, mode, position }) => ({
      data,
      id: data.id,
      mode,
      position,
    }))
  );

  const result = await getDb().execute<{ found: number; txid: string }>(sql`
    WITH design AS (
      UPDATE designs SET
        updated_at = now(),
        name = CASE
          WHEN owner_id = ${viewerId}::uuid THEN COALESCE(${name ?? null}::text, name)
          ELSE name
        END,
        width = COALESCE(${page?.width ?? null}::int, width),
        height = COALESCE(${page?.height ?? null}::int, height),
        background = COALESCE(${page ? JSON.stringify(page.background) : null}::jsonb, background)
      WHERE id = ${id}::uuid
        AND (visibility = 'public' OR owner_id = ${viewerId}::uuid)
      RETURNING id
    ),
    input AS (
      SELECT * FROM jsonb_to_recordset(${writes}::jsonb)
        AS t(id text, position text, data jsonb, mode text)
    ),
    created AS (
      INSERT INTO design_elements (design_id, id, position, data, updated_by)
      SELECT design.id, input.id, input.position, input.data, ${clientId}::uuid
      FROM input, design
      WHERE input.mode = 'create'
        AND (SELECT count(*) FROM design_elements WHERE design_id = design.id)
          + (SELECT count(*) FROM input WHERE mode = 'create') <= ${MAX_ELEMENTS}
      ON CONFLICT (design_id, id) DO UPDATE SET
        position = excluded.position,
        data = excluded.data,
        updated_by = excluded.updated_by,
        updated_at = now()
      RETURNING 1
    ),
    updated AS (
      UPDATE design_elements AS element SET
        position = input.position,
        data = input.data,
        updated_by = ${clientId}::uuid,
        updated_at = now()
      FROM input, design
      WHERE input.mode = 'update'
        AND element.design_id = design.id
        AND element.id = input.id
      RETURNING 1
    ),
    deleted AS (
      DELETE FROM design_elements AS element
      USING design
      WHERE element.design_id = design.id
        AND element.id IN (SELECT jsonb_array_elements_text(${JSON.stringify(deletes)}::jsonb))
      RETURNING 1
    )
    SELECT pg_current_xact_id()::text AS txid,
      (SELECT count(*) FROM design)::int AS found
  `);

  const [row] = result.rows;
  if (!row?.found) {
    return json({ error: "Not found" }, 404);
  }
  return json({ txid: row.txid });
};
