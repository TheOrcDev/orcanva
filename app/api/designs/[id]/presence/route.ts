import { sql } from "drizzle-orm";
import { z } from "zod";

import { getViewer } from "@/lib/auth/server";
import { MAX_PROFILE_NAME } from "@/lib/collab/identity";
import { dragPreviewSchema } from "@/lib/collab/presence";
import { getDb } from "@/lib/db/client";
import { isDesignId } from "@/lib/db/queries/designs";

const coordinate = z.number().finite().min(-100_000).max(100_000).nullable();

const presencePayload = z.object({
  clientId: z.uuid(),
  color: z.string().regex(/^#[0-9a-f]{6}$/iu),
  drag: dragPreviewSchema.nullable(),
  name: z.string().trim().min(1).max(MAX_PROFILE_NAME),
  selection: z.array(z.string().min(1).max(64)).max(500),
  x: coordinate,
  y: coordinate,
});

const json = (body: unknown, status = 200) => Response.json(body, { status });

// Updates this editor session's presence row (pointer, selection, drag) and
// clears out sessions that vanished without saying goodbye. Returns the
// server's clock so browsers can judge how fresh others' rows are.
//
// Both writes go through the `design` CTE, which only finds the design when
// the viewer may edit it. Client ids are visible to everyone on the design,
// so a row only ever updates for the same account (or guest) that made it.
// The account and avatar come from the session; the name stays the one the
// person picked (it starts as their account name), since guests can type
// any name anyway.
export const PUT = async (
  request: Request,
  context: RouteContext<"/api/designs/[id]/presence">
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
  const parsed = presencePayload.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Invalid presence" }, 422);
  }

  const viewer = await getViewer();
  const viewerId = viewer?.id ?? null;
  const { clientId, color, drag, name, selection, x, y } = parsed.data;
  const result = await getDb().execute<{
    found: number;
    now: number;
    written: number;
  }>(sql`
    WITH design AS (
      SELECT id FROM designs
      WHERE id = ${id}::uuid
        AND (visibility = 'public' OR owner_id = ${viewerId}::uuid)
    ),
    gone AS (
      DELETE FROM design_presence AS presence
      USING design
      WHERE presence.design_id = design.id
        AND presence.client_id <> ${clientId}::uuid
        AND presence.seen_at < now() - interval '2 minutes'
      RETURNING 1
    ),
    written AS (
      INSERT INTO design_presence
        (design_id, client_id, user_id, image, name, color, x, y, selection, drag, seen_at)
      SELECT design.id, ${clientId}::uuid, ${viewerId}::uuid, ${viewer?.image ?? null},
        ${name}, ${color},
        ${x}::real, ${y}::real, ${JSON.stringify(selection)}::jsonb,
        ${drag ? JSON.stringify(drag) : null}::jsonb, now()
      FROM design
      ON CONFLICT (design_id, client_id) DO UPDATE SET
        image = excluded.image,
        name = excluded.name,
        color = excluded.color,
        x = excluded.x,
        y = excluded.y,
        selection = excluded.selection,
        drag = excluded.drag,
        seen_at = now()
      WHERE design_presence.user_id IS NOT DISTINCT FROM excluded.user_id
      RETURNING 1
    )
    SELECT (SELECT count(*) FROM design)::int AS found,
      (SELECT count(*) FROM written)::int AS written,
      (extract(epoch FROM now()) * 1000)::float8 AS now
  `);

  const [row] = result.rows;
  if (!row?.found) {
    return json({ error: "Not found" }, 404);
  }
  if (!row.written) {
    return json({ error: "This session belongs to someone else" }, 409);
  }
  return json({ now: row.now });
};

// Leaving the design (sent with keepalive when the tab closes)
export const DELETE = async (
  request: Request,
  context: RouteContext<"/api/designs/[id]/presence">
): Promise<Response> => {
  const { id } = await context.params;
  const clientId = z
    .uuid()
    .safeParse(new URL(request.url).searchParams.get("clientId"));
  if (!(isDesignId(id) && clientId.success)) {
    return json({ error: "Not found" }, 404);
  }
  const viewer = await getViewer();
  // Only your own session's row: same client id, same account (or guest)
  await getDb().execute(sql`
    DELETE FROM design_presence
    WHERE design_id = ${id}::uuid
      AND client_id = ${clientId.data}::uuid
      AND user_id IS NOT DISTINCT FROM ${viewer?.id ?? null}::uuid
  `);
  return new Response(null, { status: 204 });
};
