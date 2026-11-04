import "server-only";
import { and, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { authUsers } from "@/lib/db/auth-schema";
import { getDb } from "@/lib/db/client";
import { managesHistory } from "@/lib/db/queries/designs";
import { PAGE_ORDER, WHITE_BACKGROUND, pagesOf } from "@/lib/db/queries/pages";
import { designVersions, designs } from "@/lib/db/schema";
import type { DesignVersionRow } from "@/lib/db/schema";
import { FIRST_PAGE_POSITION } from "@/lib/document/pages";
import { DOCUMENT_VERSION } from "@/lib/document/schema";
import { storageUrl, versionThumbnailKey } from "@/lib/storage/keys";
import { copyObject, deleteObject } from "@/lib/storage/s3";
import type { VersionContent } from "@/lib/versions/content";
import { versionsToPrune } from "@/lib/versions/retention";
import { MAX_NAMED_VERSIONS, VERSION_PAGE_SIZE } from "@/lib/versions/schema";
import type { VersionKind, VersionSummary } from "@/lib/versions/schema";

// Only ids shaped like a uuid become asset ids: a cast that failed would
// fail the whole statement, and with it the edit that took the snapshot
const UUID_PATTERN =
  "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$";

export interface VersionSource {
  // The CTE that found the design (its `id`) and checked who may do this.
  // `when`, `byName` and `restoredFromId` may use its columns.
  from: string;
  // Only take it when this holds
  when?: SQL;
  kind: VersionKind;
  name?: string | null;
  // Who caused it: the signed-in account, if any, and the name to show
  viewerId: string | null;
  byName: SQL;
  restoredFromId?: SQL;
}

// INSERT … SELECT of a version holding the design as the statement sees it,
// which is the state before any of the statement's own writes: every CTE in
// a statement reads the same snapshot. Element data never passes through
// Node. The design's row, pages and elements are read in LATERAL
// subqueries, so when `when` is false or `from` is empty they never run.
// Each element keeps its page; one stored without (by code from before
// pages) is on the first page. `background` is the first page's, for code
// that reads one page. Returns the new version's id.
//
// Nothing in it can fail for a design that exists: the background falls
// back to white, the creator is looked up rather than trusted (an account
// deleted mid-session becomes null instead of breaking the foreign key) and
// only well-formed asset ids are cast.
export const insertVersion = ({
  byName,
  from,
  kind,
  name = null,
  restoredFromId = sql`NULL`,
  viewerId,
  when = sql`true`,
}: VersionSource): SQL => {
  const source = sql.identifier(from);
  return sql`
  INSERT INTO design_versions (
    design_id, kind, name, content_at, created_by, created_by_name,
    restored_from_id, width, height, background, pages, doc_version,
    elements, element_count, size_bytes, asset_ids
  )
  SELECT page.id, ${kind}::design_version_kind, ${name}::text,
    page.updated_at,
    (SELECT ${authUsers.id} FROM ${authUsers} WHERE ${authUsers.id} = ${viewerId}::uuid),
    ${byName}, ${restoredFromId}, page.width, page.height,
    COALESCE(sheets.first_background, page.background, ${WHITE_BACKGROUND}::jsonb),
    sheets.pages, page.version,
    content.elements, content.element_count,
    octet_length(content.elements::text), content.asset_ids
  FROM ${source}
  CROSS JOIN LATERAL (
    SELECT id, width, height, background, version, updated_at
    FROM designs WHERE designs.id = ${source}.id
  ) AS page
  CROSS JOIN LATERAL (
    SELECT
      jsonb_agg(jsonb_build_object(
        'id', id, 'position', position, 'background', background
      ) ORDER BY ${PAGE_ORDER}) AS pages,
      (array_agg(background ORDER BY ${PAGE_ORDER}))[1] AS first_background,
      (array_agg(id ORDER BY ${PAGE_ORDER}))[1] AS first_id
    FROM ${pagesOf(sql`${source}.id`)} AS sheet
  ) AS sheets
  CROSS JOIN LATERAL (
    SELECT
      COALESCE(jsonb_agg(jsonb_build_object(
        'id', id, 'position', position,
        'pageId', COALESCE(page_id, sheets.first_id), 'data', data
      )), '[]'::jsonb) AS elements,
      count(*)::int AS element_count,
      COALESCE(array_remove(array_agg(DISTINCT CASE
        WHEN data->>'assetId' ~ ${UUID_PATTERN} THEN (data->>'assetId')::uuid
      END), NULL), '{}'::uuid[]) AS asset_ids
    FROM design_elements WHERE design_elements.design_id = ${source}.id
  ) AS content
  WHERE ${when}
  RETURNING id
`;
};

// How often a long editing session is snapshotted
const SNAPSHOT_INTERVAL = "10 minutes";
// A pause this long before someone else starts editing is a handover
const HANDOVER_PAUSE = "30 seconds";

// Whether a batch from `writer` takes an auto version, judged from the
// columns of the designs row as they were before it (an UPDATE's SET reads
// the old row, and the row lock makes Postgres judge it again if another
// batch got there first, so two batches never both take one):
// - the design has no version yet;
// - the newest is over 10 minutes old, so a long session keeps getting them;
// - someone else wrote last, the design sat for 30 s since, and the newest
//   version is older than that: the state before a new person's edits.
export const autoVersionDue = (writer: string): SQL => sql`(
  last_version_at IS NULL
  OR last_version_at < now() - ${SNAPSHOT_INTERVAL}::interval
  OR (
    updated_at < now() - ${HANDOVER_PAUSE}::interval
    AND last_writer IS DISTINCT FROM ${writer}
    AND last_version_at < now() - ${HANDOVER_PAUSE}::interval
  )
)`;

// Who to name for a snapshot: the account's name, else the name a guest's
// editor session shows others (its presence row), else "Guest"
export const writerName = (
  designId: SQL,
  viewerName: string | null,
  clientId: string
): SQL => sql`COALESCE(
  NULLIF(btrim(${viewerName}::text), ''),
  (SELECT name FROM design_presence
    WHERE design_presence.design_id = ${designId}
      AND design_presence.client_id = ${clientId}::uuid),
  'Guest'
)`;

const summaryOf = ({
  createdAt,
  thumbnailKey,
  ...version
}: Pick<
  DesignVersionRow,
  | "createdAt"
  | "createdByName"
  | "elementCount"
  | "id"
  | "kind"
  | "name"
  | "thumbnailKey"
>): VersionSummary => ({
  ...version,
  createdAt: createdAt.toISOString(),
  thumbnailUrl: thumbnailKey ? storageUrl(thumbnailKey) : null,
});

// One page of a design's history, newest first; `before` continues from
// the oldest one shown so far. Callers check access first.
export const listVersions = async (
  designId: string,
  before: Date | null
): Promise<{ versions: VersionSummary[]; next: string | null }> => {
  const rows = await getDb()
    .select({
      createdAt: designVersions.createdAt,
      createdByName: designVersions.createdByName,
      elementCount: designVersions.elementCount,
      id: designVersions.id,
      kind: designVersions.kind,
      name: designVersions.name,
      thumbnailKey: designVersions.thumbnailKey,
    })
    .from(designVersions)
    .where(
      and(
        eq(designVersions.designId, designId),
        before ? lt(designVersions.createdAt, before) : undefined
      )
    )
    .orderBy(desc(designVersions.createdAt), desc(designVersions.id))
    // One more than a page tells whether there's another
    .limit(VERSION_PAGE_SIZE + 1);
  const page = rows.slice(0, VERSION_PAGE_SIZE);
  return {
    next:
      rows.length > VERSION_PAGE_SIZE
        ? (page.at(-1)?.createdAt.toISOString() ?? null)
        : null,
    versions: page.map(summaryOf),
  };
};

// One version, whole, for the preview. Callers check access first.
export const getVersion = async (
  designId: string,
  versionId: string
): Promise<{ summary: VersionSummary; content: VersionContent } | null> => {
  const [row] = await getDb()
    .select()
    .from(designVersions)
    .where(
      and(
        eq(designVersions.id, versionId),
        eq(designVersions.designId, designId)
      )
    )
    .limit(1);
  if (!row) {
    return null;
  }
  return {
    content: {
      assetIds: row.assetIds,
      background: row.background,
      docVersion: row.docVersion,
      elements: row.elements,
      height: row.height,
      pages: row.pages,
      width: row.width,
    },
    summary: summaryOf(row),
  };
};

// Deletes one version and its picture. False when there's no such version.
// Callers check that the viewer owns the design.
export const deleteVersion = async (
  designId: string,
  versionId: string
): Promise<boolean> => {
  const [row] = await getDb()
    .delete(designVersions)
    .where(
      and(
        eq(designVersions.id, versionId),
        eq(designVersions.designId, designId)
      )
    )
    .returning({ thumbnailKey: designVersions.thumbnailKey });
  if (!row) {
    return false;
  }
  if (row.thumbnailKey) {
    await deleteObject(row.thumbnailKey).catch(() => null);
  }
  return true;
};

// Saves the design as it is now under a name, for the owner and people
// it's shared with. null: no such design for them. `id` is null when the
// design already has the most named versions it may keep.
export const saveNamedVersion = async ({
  designId,
  name,
  viewer,
}: {
  designId: string;
  name: string;
  viewer: { id: string; name: string };
}): Promise<{ id: string | null } | null> => {
  const result = await getDb().execute<{
    found: number;
    id: string | null;
  }>(sql`
    WITH design AS (
      SELECT id FROM designs
      WHERE id = ${designId}::uuid AND ${managesHistory(viewer.id)}
    ),
    saved AS (${insertVersion({
      byName: sql`${viewer.name}::text`,
      from: "design",
      kind: "named",
      name,
      viewerId: viewer.id,
      when: sql`(
        SELECT count(*) FROM design_versions
        WHERE design_versions.design_id = design.id AND kind = 'named'
      ) < ${MAX_NAMED_VERSIONS}`,
    })})
    SELECT (SELECT count(*) FROM design)::int AS found,
      (SELECT id FROM saved) AS id
  `);
  const [row] = result.rows;
  return row?.found ? { id: row.id } : null;
};

export type RestoreOutcome =
  | { status: "restored"; txid: string; restoreVersionId: string }
  // No such version, or the viewer may not manage the design's history
  | { status: "not-found" }
  // The version was written with another document version
  | { status: "outdated" };

// Puts a design back to one of its versions, in one statement, for the
// owner and people it's shared with:
// - the size comes back, restore_seq goes up (every open editor clears its
//   undo history when it sees that on the live page query) and the auto
//   version timer restarts;
// - a `restore` version keeps the state being replaced, so it can be undone
//   (which restores that version in turn);
// - the version's pages are upserted with their stored order and
//   backgrounds, and every other page is deleted: pages added since go,
//   deleted ones come back with their ids, so comments pinned to them show
//   again. A version from before pages holds one page, the design's own id;
// - the version's element rows are upserted with their stored z-order keys,
//   pages and data, unknown fields and element types included, and every
//   other row is deleted. The two touch different rows, and afterwards the
//   rows are exactly the version's, so z-order comes back exactly. Anyone's
//   update in flight to a deleted element finds nothing (a delete wins), and
//   their new elements arriving after it stay.
// A version is restored when this code can read its document version and
// it's no newer than the design's (every upgrade so far keeps elements as
// they are, so a version from before pages restores into a design with
// pages).
export const restoreVersion = async ({
  clientId,
  designId,
  versionId,
  viewer,
}: {
  clientId: string;
  designId: string;
  versionId: string;
  viewer: { id: string; name: string };
}): Promise<RestoreOutcome> => {
  const result = await getDb().execute<{
    allowed: number;
    found: number;
    restore_id: string | null;
    restored: number;
    txid: string;
  }>(sql`
    WITH version AS (
      SELECT id, width, height, background, pages, doc_version, elements
      FROM design_versions
      WHERE id = ${versionId}::uuid AND design_id = ${designId}::uuid
    ),
    version_pages AS (
      SELECT sheet.id, sheet.position, sheet.background
      FROM version,
        jsonb_to_recordset(version.pages) AS sheet(id text, position text, background jsonb)
      WHERE version.pages IS NOT NULL
      UNION ALL
      SELECT ${designId}::text, ${FIRST_PAGE_POSITION}::text, version.background
      FROM version WHERE version.pages IS NULL
    ),
    first_page AS (
      SELECT id, background FROM version_pages ORDER BY ${PAGE_ORDER} LIMIT 1
    ),
    design AS (
      UPDATE designs SET
        width = version.width,
        height = version.height,
        background = COALESCE((SELECT background FROM first_page), version.background),
        updated_at = now(),
        last_version_at = now(),
        last_writer = ${`u:${viewer.id}`},
        restore_seq = restore_seq + 1,
        restored_by_name = ${viewer.name}
      FROM version
      WHERE designs.id = ${designId}::uuid
        AND ${managesHistory(viewer.id)}
        AND version.doc_version <= designs.version
        AND version.doc_version <= ${DOCUMENT_VERSION}
      RETURNING designs.id
    ),
    saved AS (${insertVersion({
      byName: sql`${viewer.name}::text`,
      from: "design",
      kind: "restore",
      restoredFromId: sql`(SELECT id FROM version)`,
      viewerId: viewer.id,
    })}),
    pages_upserted AS (
      INSERT INTO design_pages (design_id, id, position, background, updated_by)
      SELECT design.id, version_pages.id, version_pages.position,
        version_pages.background, ${clientId}::uuid
      FROM design, version_pages
      ON CONFLICT (design_id, id) DO UPDATE SET
        position = excluded.position,
        background = excluded.background,
        updated_by = excluded.updated_by,
        updated_at = now()
      RETURNING 1
    ),
    pages_removed AS (
      DELETE FROM design_pages AS page
      USING design
      WHERE page.design_id = design.id
        AND page.id NOT IN (SELECT id FROM version_pages)
      RETURNING 1
    ),
    input AS (
      SELECT entry.id, entry.position, entry.data,
        CASE
          WHEN entry."pageId" IN (SELECT id FROM version_pages) THEN entry."pageId"
          ELSE (SELECT id FROM first_page)
        END AS page_id
      FROM version,
        jsonb_to_recordset(version.elements)
          AS entry(id text, position text, "pageId" text, data jsonb)
    ),
    upserted AS (
      INSERT INTO design_elements (design_id, id, position, data, page_id, updated_by)
      SELECT design.id, input.id, input.position, input.data, input.page_id, ${clientId}::uuid
      FROM design, input
      ON CONFLICT (design_id, id) DO UPDATE SET
        position = excluded.position,
        data = excluded.data,
        page_id = excluded.page_id,
        updated_by = excluded.updated_by,
        updated_at = now()
      RETURNING 1
    ),
    removed AS (
      DELETE FROM design_elements AS element
      USING design
      WHERE element.design_id = design.id
        AND element.id NOT IN (SELECT id FROM input)
      RETURNING 1
    )
    SELECT pg_current_xact_id()::text AS txid,
      (SELECT count(*) FROM version)::int AS found,
      (SELECT count(*) FROM designs
        WHERE designs.id = ${designId}::uuid AND ${managesHistory(viewer.id)})::int AS allowed,
      (SELECT count(*) FROM design)::int AS restored,
      (SELECT id FROM saved) AS restore_id
  `);
  const [row] = result.rows;
  if (!(row?.found && row.allowed)) {
    return { status: "not-found" };
  }
  if (!(row.restored && row.restore_id)) {
    return { status: "outdated" };
  }
  return {
    restoreVersionId: row.restore_id,
    status: "restored",
    txid: row.txid,
  };
};

// Thins out a design's history (see lib/versions/retention) and deletes
// the dropped versions' thumbnails. Returns the storage keys to delete.
export const pruneVersions = async (designId: string): Promise<string[]> => {
  const db = getDb();
  const stored = await db
    .select({
      createdAt: designVersions.createdAt,
      id: designVersions.id,
      kind: designVersions.kind,
      sizeBytes: designVersions.sizeBytes,
    })
    .from(designVersions)
    .where(eq(designVersions.designId, designId));
  const drop = versionsToPrune(
    stored.map((version) => ({
      ...version,
      createdAt: version.createdAt.getTime(),
    })),
    Date.now()
  );
  if (drop.length === 0) {
    return [];
  }
  const deleted = await db
    .delete(designVersions)
    .where(inArray(designVersions.id, drop))
    .returning({ thumbnailKey: designVersions.thumbnailKey });
  return deleted.flatMap((row) => row.thumbnailKey ?? []);
};

// Points a version at a picture already stored under `key`, unless it has
// one. False when it had one or is gone: the caller deletes the file.
export const setVersionThumbnail = async (
  designId: string,
  versionId: string,
  key: string
): Promise<boolean> => {
  const updated = await getDb()
    .update(designVersions)
    .set({ thumbnailKey: key })
    .where(
      and(
        eq(designVersions.id, versionId),
        eq(designVersions.designId, designId),
        isNull(designVersions.thumbnailKey)
      )
    )
    .returning({ id: designVersions.id });
  return updated.length > 0;
};

// Gives an auto or restore version a copy of the design's gallery picture,
// which shows the state the version holds (the picture is drawn by the
// editors a few seconds after edits stop, and the version is the state from
// before the newest batch). Designs without one get theirs when the version
// is first previewed.
const copyDesignThumbnail = async (
  designId: string,
  versionId: string
): Promise<void> => {
  const [design] = await getDb()
    .select({ thumbnailKey: designs.thumbnailKey })
    .from(designs)
    .where(eq(designs.id, designId))
    .limit(1);
  if (!design?.thumbnailKey) {
    return;
  }
  const key = versionThumbnailKey(designId);
  await copyObject(design.thumbnailKey, key);
  if (!(await setVersionThumbnail(designId, versionId, key))) {
    await deleteObject(key);
  }
};

const deleteFiles = async (keys: readonly string[]): Promise<void> => {
  await Promise.allSettled(keys.map((key) => deleteObject(key)));
};

// After a snapshot was taken (in after(), so the edit that took it doesn't
// wait): its picture, then pruning, which also deletes the pictures of the
// versions it drops. Failures are dropped: a version without a picture gets
// one when it's previewed, and the next snapshot prunes again.
export const finishSnapshot = async (
  designId: string,
  versionId: string
): Promise<void> => {
  await copyDesignThumbnail(designId, versionId).catch(() => null);
  const dropped = await pruneVersions(designId).catch(() => []);
  await deleteFiles(dropped);
};
