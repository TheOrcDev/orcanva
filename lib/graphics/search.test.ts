import { describe, expect, it } from "vitest";

import { parseCatalogIndex } from "@/lib/graphics/catalog";
import type { CatalogIndex } from "@/lib/graphics/catalog-data";
import {
  normalizeQuery,
  prepareSearch,
  searchGraphics,
} from "@/lib/graphics/search";

// In catalog order: stickers, emoji, then icons
const INDEX: CatalogIndex = {
  format: 1,
  rows: [
    ["sticker:arrow-bold", "sticker", "Red arrow", "arrow point right red", 0],
    ["sticker:circle", "sticker", "Red circle", "circle ring highlight", 0],
    ["fluent:fire", "emoji", "Fire", "fire flame hot 🔥", 1],
    [
      "fluent:face-screaming-in-fear",
      "emoji",
      "Face screaming in fear",
      "face fear munch scared scream shock 😱",
      1,
    ],
    ["fluent:fire-engine", "emoji", "Fire engine", "engine fire truck 🚒", 1],
    ["tabler:arrow-right", "icon", "Arrow right", "arrow right next", 2],
    ["tabler:flame", "icon", "Flame", "flame fire burn hot", 2],
    ["tabler:campfire", "icon", "Campfire", "camp outdoor", 2],
    ["tabler:cafe", "icon", "Café", "coffee drink", 2],
  ],
};
const search = prepareSearch(INDEX);
const ids = (
  query: string,
  filter: Parameters<typeof searchGraphics>[2] = "all"
) => searchGraphics(search, query, filter).map(([id]) => id);

describe("searchGraphics", () => {
  it("ranks the exact name, then name prefixes, keyword prefixes, substrings", () => {
    expect(ids("fire")).toEqual([
      // Exact name
      "fluent:fire",
      // The name starts with it
      "fluent:fire-engine",
      // A keyword does
      "tabler:flame",
      // Somewhere inside
      "tabler:campfire",
    ]);
  });

  it("puts stickers, then emoji, before icons that match as well", () => {
    expect(ids("arrow")).toEqual(["sticker:arrow-bold", "tabler:arrow-right"]);
  });

  it("matches every word of a longer query, in any order", () => {
    expect(ids("scared face")).toEqual(["fluent:face-screaming-in-fear"]);
    expect(ids("red ring")).toEqual(["sticker:circle"]);
  });

  it("ignores case, accents and punctuation, and finds emoji by glyph", () => {
    expect(ids("  FIRE-engine ")).toEqual(["fluent:fire-engine"]);
    expect(ids("cafe")).toEqual(["tabler:cafe"]);
    expect(ids("😱")).toEqual(["fluent:face-screaming-in-fear"]);
  });

  it("filters by kind, and lists the whole kind with no query", () => {
    expect(ids("fire", "icon")).toEqual(["tabler:flame", "tabler:campfire"]);
    expect(ids("fire", "sticker")).toEqual([]);
    expect(ids("", "sticker")).toEqual([
      "sticker:arrow-bold",
      "sticker:circle",
    ]);
    expect(ids("", "all")).toHaveLength(INDEX.rows.length);
  });

  it("finds nothing for nonsense", () => {
    expect(ids("zzzz")).toEqual([]);
  });

  it("searches a catalog the size of the real one quickly", () => {
    const rows = Array.from(
      { length: 8000 },
      (_, index) =>
        [
          `tabler:icon-${index}`,
          "icon",
          `Icon ${index}`,
          "shape line thing arrow star",
          0,
        ] as CatalogIndex["rows"][number]
    );
    const big = prepareSearch({ format: 1, rows });
    const start = performance.now();
    searchGraphics(big, "star", "all");
    searchGraphics(big, "icon 7", "icon");
    // A few ms normally; the bound only catches a slow algorithm, even on a
    // machine busy with other work
    expect(performance.now() - start).toBeLessThan(500);
  });
});

describe("normalizeQuery", () => {
  it("folds text the way the index is folded", () => {
    expect(normalizeQuery("Crème Brûlée!")).toBe("creme brulee");
    expect(normalizeQuery("thumbs_up 👍")).toBe("thumbs up 👍");
  });
});

describe("parseCatalogIndex", () => {
  it("reads a catalog index", () => {
    expect(parseCatalogIndex(INDEX)).toEqual(INDEX);
  });

  it("rejects anything malformed", () => {
    const bad = [
      null,
      "index",
      { rows: INDEX.rows },
      { format: 2, rows: INDEX.rows },
      { format: 1, rows: [["tabler:x", "icon", "X", "x"]] },
      { format: 1, rows: [["tabler:x", "font", "X", "x", 0]] },
      { format: 1, rows: [["tabler:x", "icon", "X", "x", -1]] },
      { format: 1, rows: [["", "icon", "X", "x", 0]] },
    ];
    for (const json of bad) {
      expect(() => parseCatalogIndex(json)).toThrow();
    }
  });
});
