import { generateNKeysBetween } from "fractional-indexing";

// Z-order is stored as a fractional index per element: a string key that
// sorts in stacking order and can always fit another key between two others,
// so a reorder or insert rewrites only the elements that moved.
export type Positions = ReadonlyMap<string, string>;

export interface Positioned {
  id: string;
  position: string;
}

// Code-unit order, matching the keys' base-62 digits. Two people inserting at
// the same spot can produce equal keys; the id breaks the tie.
export const comparePositioned = (a: Positioned, b: Positioned): number => {
  if (a.position !== b.position) {
    return a.position < b.position ? -1 : 1;
  }
  if (a.id === b.id) {
    return 0;
  }
  return a.id < b.id ? -1 : 1;
};

// Indexes of the longest strictly increasing run of existing keys
// (patience sorting); those keys can stay as they are
const longestIncreasing = (
  keys: readonly (string | undefined)[]
): Set<number> => {
  const tails: number[] = [];
  const previous: number[] = keys.map(() => -1);

  for (const [index, key] of keys.entries()) {
    if (key !== undefined) {
      let low = 0;
      let high = tails.length;
      while (low < high) {
        const middle = Math.floor((low + high) / 2);
        const tail = keys[tails[middle] ?? 0] ?? "";
        if (tail < key) {
          low = middle + 1;
        } else {
          high = middle;
        }
      }
      previous[index] = low > 0 ? (tails[low - 1] ?? -1) : -1;
      tails[low] = index;
    }
  }

  const kept = new Set<number>();
  let cursor = tails.at(-1) ?? -1;
  while (cursor !== -1) {
    kept.add(cursor);
    cursor = previous[cursor] ?? -1;
  }
  return kept;
};

// Gives every id in `order` a key that sorts in that order, keeping as many
// existing keys as possible and generating new ones only for the gaps
export const assignPositions = (
  previous: Positions,
  order: readonly string[]
): Map<string, string> => {
  const keys = order.map((id) => previous.get(id));
  const kept = longestIncreasing(keys);
  const result = new Map<string, string>();
  let gap: string[] = [];
  let left: string | null = null;

  const fillGap = (right: string | null) => {
    if (gap.length === 0) {
      return;
    }
    const fresh = generateNKeysBetween(left, right, gap.length);
    for (const [offset, id] of gap.entries()) {
      result.set(id, fresh[offset] ?? "");
    }
    gap = [];
  };

  for (const [index, id] of order.entries()) {
    const key = keys[index];
    if (kept.has(index) && key !== undefined) {
      fillGap(key);
      result.set(id, key);
      left = key;
    } else {
      gap.push(id);
    }
  }
  fillGap(null);
  return result;
};
