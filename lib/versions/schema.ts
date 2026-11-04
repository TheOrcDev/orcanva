// Version history: snapshots of a design's page and elements, kept in
// design_versions (see lib/db/schema.ts).

// auto: taken by the server before someone's edits. named: saved by a
// person under a name. restore: the state a restore replaced, so it can be
// undone.
export const VERSION_KINDS = ["auto", "named", "restore"] as const;
export type VersionKind = (typeof VERSION_KINDS)[number];

// One element as a version stores it: the row's id, z-order key, page and
// data, exactly as design_elements had them. pageId is null in versions
// taken before designs had pages; null means the first page.
export interface VersionElement {
  id: string;
  position: string;
  pageId: string | null;
  data: unknown;
}

// One page as a version stores it (design_versions.pages), exactly as
// design_pages had it. The background is unvalidated jsonb.
export interface VersionPage {
  id: string;
  position: string;
  background: unknown;
}

// Named versions are never pruned, so each design keeps at most this many
export const MAX_NAMED_VERSIONS = 50;

export const MAX_VERSION_NAME = 60;

// A version as the history list shows it (GET /api/designs/[id]/versions)
export interface VersionSummary {
  id: string;
  kind: VersionKind;
  // Named versions only
  name: string | null;
  // ISO time it was taken
  createdAt: string;
  // Who caused it (see design_versions.created_by_name)
  createdByName: string;
  elementCount: number;
  // A picture of it, once there is one
  thumbnailUrl: string | null;
}

// Versions per page of the history list
export const VERSION_PAGE_SIZE = 30;
