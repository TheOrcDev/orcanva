import type { CatalogIndex, IndexRow } from "@/lib/graphics/catalog-data";
import type { GraphicKind } from "@/lib/graphics/entry";

// What the chips filter by
export type GraphicFilter = GraphicKind | "all";

// Stickers, then emoji, then icons, when results rank the same
const KIND_RANK: Record<string, number> = { emoji: 1, icon: 2, sticker: 0 };

interface SearchRow {
  row: IndexRow;
  // Index order, the last tie-breaker
  order: number;
  name: string;
  words: string[];
  text: string;
}

export interface SearchIndex {
  rows: SearchRow[];
}

const MARKS = /\p{M}/gu;
const SEPARATORS = /[^\p{L}\p{N}\p{Extended_Pictographic}]+/gu;

// Lower case, accents off, anything that isn't a letter, digit or emoji a
// single space. Emoji glyphs stay searchable: their keywords hold the glyph.
export const normalizeQuery = (text: string): string =>
  text
    .normalize("NFKD")
    .replaceAll(MARKS, "")
    .toLowerCase()
    .replaceAll(SEPARATORS, " ")
    .trim();

export const prepareSearch = (index: CatalogIndex): SearchIndex => ({
  rows: index.rows.map((row, order) => {
    const name = normalizeQuery(row[2]);
    const keywords = normalizeQuery(row[3]);
    return {
      name,
      order,
      row,
      text: `${name} ${keywords}`,
      words: `${name} ${keywords}`.split(" ").filter(Boolean),
    };
  }),
});

// 0 the exact name, 1 the name (or a word in it) starts with the query,
// 2 every word of the query starts a word of the name or keywords,
// 3 the query is anywhere in them; null for no match
const levelOf = (
  row: SearchRow,
  query: string,
  terms: string[]
): number | null => {
  if (row.name === query) {
    return 0;
  }
  if (` ${row.name}`.includes(` ${query}`)) {
    return 1;
  }
  if (terms.every((term) => row.words.some((word) => word.startsWith(term)))) {
    return 2;
  }
  return row.text.includes(query) ? 3 : null;
};

const kindRank = (row: SearchRow) => KIND_RANK[row.row[1]] ?? 3;

const matchesFilter = (row: SearchRow, filter: GraphicFilter) =>
  filter === "all" || row.row[1] === filter;

// Every match, best first; with no query, every graphic of the kind in
// catalog order
export const searchGraphics = (
  index: SearchIndex,
  rawQuery: string,
  filter: GraphicFilter
): IndexRow[] => {
  const query = normalizeQuery(rawQuery);
  const candidates = index.rows.filter((row) => matchesFilter(row, filter));
  if (query === "") {
    return candidates.map(({ row }) => row);
  }
  const terms = query.split(" ");
  const ranked: { level: number; row: SearchRow }[] = [];
  for (const row of candidates) {
    const level = levelOf(row, query, terms);
    if (level !== null) {
      ranked.push({ level, row });
    }
  }
  return ranked
    .toSorted(
      (first, second) =>
        first.level - second.level ||
        kindRank(first.row) - kindRank(second.row) ||
        first.row.order - second.row.order
    )
    .map(({ row }) => row.row);
};
