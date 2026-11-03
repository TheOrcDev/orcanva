import "server-only";
import { sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import type { ElementWrite } from "@/lib/collab/outbox";
import { visibleTo } from "@/lib/db/queries/designs";
import {
  autoVersionDue,
  insertVersion,
  writerName,
} from "@/lib/db/queries/versions";
import { MAX_ELEMENTS } from "@/lib/document/schema";
import type { Background } from "@/lib/document/schema";

export interface ChangesInput {
  designId: string;
  // The signed-in person, or null for a guest
  viewer: { id: string; name: string } | null;
  // The editor session writing
  clientId: string;
  writes: readonly ElementWrite[];
  deletes: readonly string[];
  name: string | null;
  page: { width: number; height: number; background: Background } | null;
}

// The statement that saves one batch from POST /api/designs/[id]/changes:
// element writes, deletes and page settings, in one transaction whose id
// the client waits for on the live query. Creates upsert; updates only
// touch rows that still exist, so an element someone deleted stays deleted.
//
// Access is checked inside the statement: the design row is only updated
// (and locked) when the viewer may edit it, and every element write joins
// that row. Postgres runs every data-modifying CTE whether or not anything
// reads it, so a write that didn't join `design` would bypass the check.
// Only the owner's name changes stick; others' are ignored rather than
// refused, since a refusal would drop the element writes batched with it.
//
// Version history: when an auto version is due (autoVersionDue), the
// `snapshot` CTE copies the design as it was before this batch into
// design_versions, so a guest's edits can't skip it. That INSERT can't fail
// for a design that exists (see insertVersion), so it can't fail the edit.
// `designs` stays unaliased: visibleTo() names its columns as "designs".
//
// Returns one row: `txid`, `found` (0 when the design is gone or the viewer
// may not edit it) and `snapshot_id` (the auto version it took, if any).
export const changesStatement = ({
  clientId,
  deletes,
  designId,
  name,
  page,
  viewer,
  writes,
}: ChangesInput): SQL => {
  const viewerId = viewer?.id ?? null;
  const input = JSON.stringify(
    writes.map(({ data, mode, position }) => ({
      data,
      id: data.id,
      mode,
      position,
    }))
  );
  // Accounts are one writer across their tabs; a guest is one per session
  const writer = viewerId ? `u:${viewerId}` : `c:${clientId}`;

  return sql`
    WITH design AS (
      UPDATE designs SET
        updated_at = now(),
        last_writer = ${writer},
        last_version_at = CASE WHEN ${autoVersionDue(writer)} THEN now() ELSE last_version_at END,
        name = CASE
          WHEN owner_id = ${viewerId}::uuid THEN COALESCE(${name}::text, name)
          ELSE name
        END,
        width = COALESCE(${page?.width ?? null}::int, width),
        height = COALESCE(${page?.height ?? null}::int, height),
        background = COALESCE(${page ? JSON.stringify(page.background) : null}::jsonb, background)
      WHERE id = ${designId}::uuid
        AND ${visibleTo(viewerId)}
      RETURNING id, COALESCE(last_version_at = now(), false) AS snapshot_due
    ),
    snapshot AS (${insertVersion({
      byName: writerName(sql`design.id`, viewer?.name ?? null, clientId),
      from: "design",
      kind: "auto",
      viewerId,
      when: sql`design.snapshot_due`,
    })}),
    input AS (
      SELECT * FROM jsonb_to_recordset(${input}::jsonb)
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
      (SELECT count(*) FROM design)::int AS found,
      (SELECT id FROM snapshot) AS snapshot_id
  `;
};
