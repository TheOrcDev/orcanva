import "server-only";
import { dangerouslyDeleteByTag } from "@vercel/functions";

// Vercel's CDN keeps every file the storage route serves for a year (they're
// immutable), tagged with its key, so deleting a file for good also drops
// the CDN's copy. Browsers that already loaded it keep theirs.

// Vercel's limit on a tag; keys this app makes are far shorter
const MAX_TAG_BYTES = 256;
// Tags per purge call (Vercel's limit for its bulk API)
const TAGS_PER_PURGE = 16;

// The tag the storage route puts on a file's response, or null for a key
// too long to be one of ours
export const storageCacheTag = (key: string): string | null =>
  Buffer.byteLength(key) <= MAX_TAG_BYTES ? key : null;

// Drops the CDN's copies of these files; does nothing outside Vercel
export const purgeStorageCache = async (
  keys: readonly string[]
): Promise<void> => {
  const tags = keys.flatMap((key) => storageCacheTag(key) ?? []);
  const batches: string[][] = [];
  for (let start = 0; start < tags.length; start += TAGS_PER_PURGE) {
    batches.push(tags.slice(start, start + TAGS_PER_PURGE));
  }
  await Promise.all(batches.map((batch) => dangerouslyDeleteByTag(batch)));
};
