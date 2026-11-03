import type { VersionKind } from "@/lib/versions/schema";

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// Auto versions: every one from the last day, then the newest of each hour
// for a week, then the newest of each day for a month
export const KEEP_ALL_MS = DAY_MS;
export const KEEP_HOURLY_MS = 7 * DAY_MS;
export const KEEP_DAILY_MS = 30 * DAY_MS;
// Restore versions, which let a restore be undone
export const KEEP_RESTORES_MS = 30 * DAY_MS;
// What one design's versions may take up, by their size_bytes
export const VERSION_BUDGET_BYTES = 50 * 1024 * 1024;

export interface StoredVersion {
  id: string;
  kind: VersionKind;
  // Milliseconds since the epoch
  createdAt: number;
  sizeBytes: number;
}

// Newest first; equal times by id, so the choice never depends on row order
const newestFirst = (a: StoredVersion, b: StoredVersion): number => {
  if (a.createdAt !== b.createdAt) {
    return b.createdAt - a.createdAt;
  }
  if (a.id === b.id) {
    return 0;
  }
  return a.id < b.id ? 1 : -1;
};

// The hour or day an older auto version is thinned to one per, or null
// while every version of its age is kept. Buckets are fixed spans of time,
// so a version kept today is still the one kept tomorrow.
const bucketOf = (version: StoredVersion, now: number): string | null => {
  const age = now - version.createdAt;
  if (age <= KEEP_ALL_MS) {
    return null;
  }
  if (age <= KEEP_HOURLY_MS) {
    return `hour:${Math.floor(version.createdAt / HOUR_MS)}`;
  }
  return `day:${Math.floor(version.createdAt / DAY_MS)}`;
};

// Which versions by the tiers above. Named versions stay; the newest
// version of all always stays.
const keptByAge = (
  sorted: readonly StoredVersion[],
  now: number
): StoredVersion[] => {
  const seen = new Set<string>();
  return sorted.filter((version, index) => {
    if (index === 0 || version.kind === "named") {
      return true;
    }
    const age = now - version.createdAt;
    if (version.kind === "restore") {
      return age <= KEEP_RESTORES_MS;
    }
    if (age > KEEP_DAILY_MS) {
      return false;
    }
    const bucket = bucketOf(version, now);
    if (bucket === null) {
      return true;
    }
    // Newest first, so the first one met is the newest of its bucket
    if (seen.has(bucket)) {
      return false;
    }
    seen.add(bucket);
    return true;
  });
};

// Over budget: the oldest auto versions go first, then the oldest restore
// versions. Named versions and the newest version are never dropped, so a
// design can stay over budget with only those left.
const withinBudget = (
  kept: readonly StoredVersion[],
  budget: number
): Set<string> => {
  let total = kept.reduce((sum, version) => sum + version.sizeBytes, 0);
  const dropped = new Set<string>();
  const newest = kept[0]?.id;
  for (const kind of ["auto", "restore"] as const) {
    for (const version of kept.toReversed()) {
      if (total <= budget) {
        return dropped;
      }
      if (version.kind === kind && version.id !== newest) {
        dropped.add(version.id);
        total -= version.sizeBytes;
      }
    }
  }
  return dropped;
};

// The ids of the versions to delete from one design's history
export const versionsToPrune = (
  versions: readonly StoredVersion[],
  now: number,
  budget = VERSION_BUDGET_BYTES
): string[] => {
  const sorted = versions.toSorted(newestFirst);
  const kept = keptByAge(sorted, now);
  const keptIds = new Set(kept.map((version) => version.id));
  const overBudget = withinBudget(kept, budget);
  return sorted
    .filter((version) => !keptIds.has(version.id) || overBudget.has(version.id))
    .map((version) => version.id);
};
