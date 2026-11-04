import "server-only";
import { sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { visibleTo } from "@/lib/db/queries/designs";
import { PAGE_ORDER, pagesOf } from "@/lib/db/queries/pages";
import {
  autoVersionDue,
  insertVersion,
  writerName,
} from "@/lib/db/queries/versions";
import type { ChangesWrites } from "@/lib/document/changes-payload";
import { PAGES_VERSION } from "@/lib/document/pages";
import { MAX_ELEMENTS, MAX_PAGES } from "@/lib/document/schema";

export interface ChangesInput extends ChangesWrites {
  designId: string;
  // The signed-in person, or null for a guest
  viewer: { id: string; name: string } | null;
  // The editor session writing
  clientId: string;
}

// The statement that saves one batch from POST /api/designs/[id]/changes:
// page writes and deletes, element writes and deletes, the size and the
// name, in one transaction whose id the client waits for on the live
// queries. Creates upsert; updates only touch rows that still exist, so an
// element or page someone deleted stays deleted.
//
// Access is checked inside the statement: the design row is only updated
// (and locked) when the viewer may edit it, and every write joins that row.
// Postgres runs every data-modifying CTE whether or not anything reads it,
// so a write that didn't join `design` would bypass the check. Only the
// owner's name changes stick; others' are ignored rather than refused,
// since a refusal would drop the element writes batched with it.
//
// Pages, in order:
// - `before_pages` is the design's pages as the statement sees them (a
//   design that code from before pages made has none stored: its one page
//   is the design's id with the row's background, and it's stored now);
// - creates are refused when they'd take the design past MAX_PAGES, and
//   updates skip pages that are gone;
// - deletes are skipped when they'd leave no page;
// - `after_pages` is what's left, and every element write must land on one
//   of those: the page it names, else the one its row is on, else the first
//   page (resolvePageId). A write to a page someone deleted is dropped, as an
//   update of a deleted element is. A deleted page's elements are deleted
//   with it (and from contract migration 0016, by its foreign key too), but
//   not ones this batch moves to another page.
// A delete committed by another batch after this statement's snapshot but
// before its row lock fails the foreign key check (23503, so a 500); the
// outbox retries, this guard then drops the write, and the delete wins.
//
// Tabs from before pages send the size and their only page's background
// (`firstPageBackground`), which goes to the first page. The first page's
// background is also copied into designs.background, which those tabs'
// page query reads, until 10.10 drops it. A batch that creates a page
// raises the design's version to PAGES_VERSION, so tabs from before pages
// stop (G2) rather than show and save only its first page.
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
  firstPageBackground,
  name,
  pageDeletes,
  pages,
  size,
  viewer,
  writes,
}: ChangesInput): SQL => {
  const viewerId = viewer?.id ?? null;
  const elementInput = JSON.stringify(
    writes.map(({ data, mode, pageId, position }) => ({
      data,
      id: data.id,
      mode,
      page_id: pageId,
      position,
    }))
  );
  const pageInput = JSON.stringify(pages);
  // Accounts are one writer across their tabs; a guest is one per session
  const writer = viewerId ? `u:${viewerId}` : `c:${clientId}`;
  const id = sql`${designId}::uuid`;

  return sql`
    WITH stored_pages AS (
      SELECT id FROM design_pages WHERE design_id = ${id}
    ),
    before_pages AS (SELECT * FROM ${pagesOf(id)} AS page),
    page_input AS (
      SELECT * FROM jsonb_to_recordset(${pageInput}::jsonb)
        AS t(id text, mode text, position text, background jsonb)
    ),
    drop_request AS (
      SELECT id FROM before_pages
      WHERE id IN (SELECT jsonb_array_elements_text(${JSON.stringify(pageDeletes)}::jsonb))
        AND id NOT IN (SELECT id FROM page_input)
    ),
    page_writes AS (
      SELECT id, position, background FROM page_input
      WHERE (mode = 'update' AND id IN (SELECT id FROM before_pages))
        OR (mode = 'create' AND (
          (SELECT count(*) FROM before_pages)
          - (SELECT count(*) FROM drop_request)
          + (SELECT count(*) FROM page_input
              WHERE mode = 'create' AND id NOT IN (SELECT id FROM before_pages))
        ) <= ${MAX_PAGES})
      UNION ALL
      -- A tab from before pages: its background is the first page's
      SELECT first.id, first.position, ${firstPageBackground ? JSON.stringify(firstPageBackground) : null}::jsonb
      FROM (
        SELECT id, position FROM before_pages ORDER BY ${PAGE_ORDER} LIMIT 1
      ) AS first
      WHERE ${firstPageBackground ? JSON.stringify(firstPageBackground) : null}::jsonb IS NOT NULL
        AND first.id NOT IN (SELECT id FROM page_input)
        AND first.id NOT IN (SELECT id FROM drop_request)
      UNION ALL
      -- A page that isn't stored yet becomes a row, so elements can point
      -- at it
      SELECT id, position, background FROM before_pages
      WHERE NOT EXISTS (SELECT 1 FROM stored_pages)
        AND ${firstPageBackground ? JSON.stringify(firstPageBackground) : null}::jsonb IS NULL
        AND id NOT IN (SELECT id FROM page_input)
        AND id NOT IN (SELECT id FROM drop_request)
    ),
    dropped_pages AS (
      SELECT id FROM drop_request
      WHERE EXISTS (SELECT 1 FROM page_writes)
        OR EXISTS (
          SELECT 1 FROM before_pages
          WHERE id NOT IN (SELECT id FROM drop_request)
        )
    ),
    after_pages AS (
      SELECT id, position, background FROM page_writes
      UNION ALL
      SELECT id, position, background FROM before_pages
      WHERE id NOT IN (SELECT id FROM page_writes)
        AND id NOT IN (SELECT id FROM dropped_pages)
    ),
    first_after AS (
      SELECT id, background FROM after_pages ORDER BY ${PAGE_ORDER} LIMIT 1
    ),
    design AS (
      UPDATE designs SET
        updated_at = now(),
        last_writer = ${writer},
        last_version_at = CASE WHEN ${autoVersionDue(writer)} THEN now() ELSE last_version_at END,
        name = CASE
          WHEN owner_id = ${viewerId}::uuid THEN COALESCE(${name}::text, name)
          ELSE name
        END,
        width = COALESCE(${size?.width ?? null}::int, width),
        height = COALESCE(${size?.height ?? null}::int, height),
        background = COALESCE((SELECT background FROM first_after), background),
        version = CASE
          WHEN EXISTS (
            SELECT 1 FROM page_writes
            WHERE id NOT IN (SELECT id FROM before_pages)
          ) THEN GREATEST(version, ${PAGES_VERSION})
          ELSE version
        END
      WHERE id = ${id}
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
    pages_written AS (
      INSERT INTO design_pages (design_id, id, position, background, updated_by)
      SELECT design.id, page.id, page.position, page.background, ${clientId}::uuid
      FROM page_writes AS page, design
      ON CONFLICT (design_id, id) DO UPDATE SET
        position = excluded.position,
        background = excluded.background,
        updated_by = excluded.updated_by,
        updated_at = now()
      RETURNING 1
    ),
    pages_deleted AS (
      DELETE FROM design_pages AS page
      USING design
      WHERE page.design_id = design.id
        AND page.id IN (SELECT id FROM dropped_pages)
      RETURNING 1
    ),
    input AS (
      SELECT * FROM jsonb_to_recordset(${elementInput}::jsonb)
        AS t(id text, position text, data jsonb, mode text, page_id text)
    ),
    placed AS (
      SELECT input.id, input.position, input.data, input.mode,
        COALESCE(input.page_id, current.page_id, (SELECT id FROM first_after)) AS page_id
      FROM input
      LEFT JOIN design_elements AS current
        ON current.design_id = ${id} AND current.id = input.id
      WHERE COALESCE(input.page_id, current.page_id, (SELECT id FROM first_after))
        IN (SELECT id FROM after_pages)
    ),
    created AS (
      INSERT INTO design_elements (design_id, id, position, data, page_id, updated_by)
      SELECT design.id, placed.id, placed.position, placed.data, placed.page_id, ${clientId}::uuid
      FROM placed, design
      WHERE placed.mode = 'create'
        AND (SELECT count(*) FROM design_elements WHERE design_id = design.id)
          + (SELECT count(*) FROM input WHERE mode = 'create') <= ${MAX_ELEMENTS}
      ON CONFLICT (design_id, id) DO UPDATE SET
        position = excluded.position,
        data = excluded.data,
        page_id = excluded.page_id,
        updated_by = excluded.updated_by,
        updated_at = now()
      RETURNING 1
    ),
    updated AS (
      UPDATE design_elements AS element SET
        position = placed.position,
        data = placed.data,
        page_id = placed.page_id,
        updated_by = ${clientId}::uuid,
        updated_at = now()
      FROM placed, design
      WHERE placed.mode = 'update'
        AND element.design_id = design.id
        AND element.id = placed.id
      RETURNING 1
    ),
    deleted AS (
      DELETE FROM design_elements AS element
      USING design
      WHERE element.design_id = design.id
        AND (
          element.id IN (SELECT jsonb_array_elements_text(${JSON.stringify(deletes)}::jsonb))
          OR (
            COALESCE(element.page_id, ${id}::text) IN (SELECT id FROM dropped_pages)
            AND element.id NOT IN (SELECT id FROM placed)
          )
        )
      RETURNING 1
    )
    SELECT pg_current_xact_id()::text AS txid,
      (SELECT count(*) FROM design)::int AS found,
      (SELECT id FROM snapshot) AS snapshot_id
  `;
};
