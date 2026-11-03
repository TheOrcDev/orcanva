import "server-only";
import { eq, inArray, sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { authUsers } from "@/lib/db/auth-schema";
import { getDb } from "@/lib/db/client";
import { designVersions } from "@/lib/db/schema";
import { versionsToPrune } from "@/lib/versions/retention";
import type { VersionKind } from "@/lib/versions/schema";

// What a design without a stored background shows (see migrateDocument)
const WHITE = JSON.stringify({ color: "#ffffff", type: "solid" });

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
// Node. The design's row and elements are read in LATERAL subqueries, so
// when `when` is false or `from` is empty they never run. Each element's
// page is null (the first page) until designs have pages (plan 10).
// Returns the new version's id.
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
    restored_from_id, width, height, background, doc_version, elements,
    element_count, size_bytes, asset_ids
  )
  SELECT page.id, ${kind}::design_version_kind, ${name}::text,
    page.updated_at,
    (SELECT ${authUsers.id} FROM ${authUsers} WHERE ${authUsers.id} = ${viewerId}::uuid),
    ${byName}, ${restoredFromId}, page.width, page.height,
    COALESCE(page.background, ${WHITE}::jsonb), page.version,
    content.elements, content.element_count,
    octet_length(content.elements::text), content.asset_ids
  FROM ${source}
  CROSS JOIN LATERAL (
    SELECT id, width, height, background, version, updated_at
    FROM designs WHERE designs.id = ${source}.id
  ) AS page
  CROSS JOIN LATERAL (
    SELECT
      COALESCE(jsonb_agg(jsonb_build_object(
        'id', id, 'position', position, 'pageId', NULL, 'data', data
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

// After a snapshot was taken (in after(), so the edit that took it doesn't
// wait): prunes the design's history. Failures are dropped; the next
// snapshot prunes again.
export const finishSnapshot = async (designId: string): Promise<void> => {
  await pruneVersions(designId).catch(() => null);
};
