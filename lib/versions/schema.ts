// Version history: snapshots of a design's page and elements, kept in
// design_versions (see lib/db/schema.ts).

// auto: taken by the server before someone's edits. named: saved by a
// person under a name. restore: the state a restore replaced, so it can be
// undone.
export const VERSION_KINDS = ["auto", "named", "restore"] as const;
export type VersionKind = (typeof VERSION_KINDS)[number];

// One element as a version stores it: the row's id, z-order key and data,
// exactly as design_elements had them. pageId is null until designs have
// pages (plan 10); null means the first page.
export interface VersionElement {
  id: string;
  position: string;
  pageId: string | null;
  data: unknown;
}

// Named versions are never pruned, so each design keeps at most this many
export const MAX_NAMED_VERSIONS = 50;

export const MAX_VERSION_NAME = 60;
