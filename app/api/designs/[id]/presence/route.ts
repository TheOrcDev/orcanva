import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { MAX_PROFILE_NAME } from "@/lib/collab/identity";
import { dragPreviewSchema } from "@/lib/collab/presence";
import { getDb } from "@/lib/db/client";
import { isDesignId } from "@/lib/db/queries/designs";
import { designPresence } from "@/lib/db/schema";

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

  const { clientId, color, drag, name, selection, x, y } = parsed.data;
  const result = await getDb().execute<{ now: number }>(sql`
    WITH gone AS (
      DELETE FROM design_presence
      WHERE design_id = ${id}::uuid
        AND client_id <> ${clientId}::uuid
        AND seen_at < now() - interval '2 minutes'
      RETURNING 1
    )
    INSERT INTO design_presence
      (design_id, client_id, name, color, x, y, selection, drag, seen_at)
    SELECT ${id}::uuid, ${clientId}::uuid, ${name}, ${color}, ${x}::real, ${y}::real,
      ${JSON.stringify(selection)}::jsonb, ${drag ? JSON.stringify(drag) : null}::jsonb, now()
    WHERE EXISTS (SELECT 1 FROM designs WHERE id = ${id}::uuid)
    ON CONFLICT (design_id, client_id) DO UPDATE SET
      name = excluded.name,
      color = excluded.color,
      x = excluded.x,
      y = excluded.y,
      selection = excluded.selection,
      drag = excluded.drag,
      seen_at = now()
    RETURNING (extract(epoch FROM now()) * 1000)::float8 AS now
  `);

  const [row] = result.rows;
  if (!row) {
    return json({ error: "Not found" }, 404);
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
  await getDb()
    .delete(designPresence)
    .where(
      and(
        eq(designPresence.designId, id),
        eq(designPresence.clientId, clientId.data)
      )
    );
  return new Response(null, { status: 204 });
};
