import { describe, expect, it } from "vitest";

import {
  MAX_RECENT_COLORS,
  RECENT_COLORS_KEY,
  addRecentColor,
  loadRecentColors,
  parseRecentColors,
  rememberRecentColor,
} from "@/lib/editor/recent-colors";

// Enough of localStorage for these tests
const memoryStorage = (initial: Record<string, string> = {}) => {
  const items = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => {
      items.set(key, value);
    },
  } as Storage;
};

const hexOf = (index: number) => `#0000${index.toString(16).padStart(2, "0")}`;

describe("recent colours", () => {
  it("adds newest first, once each", () => {
    expect(addRecentColor([], "#FF0000")).toEqual(["#ff0000"]);
    expect(addRecentColor(["#00ff00", "#ff0000"], "#f00")).toEqual([
      "#ff0000",
      "#00ff00",
    ]);
    expect(addRecentColor(["#00ff00"], "not a colour")).toEqual(["#00ff00"]);
  });

  it("keeps only the newest few", () => {
    const full = Array.from({ length: MAX_RECENT_COLORS }, (_, index) =>
      hexOf(index)
    );
    const added = addRecentColor(full, "#ffffff");
    expect(added).toHaveLength(MAX_RECENT_COLORS);
    expect(added[0]).toBe("#ffffff");
    expect(added).not.toContain(hexOf(MAX_RECENT_COLORS - 1));
  });

  it("survives whatever was stored", () => {
    expect(parseRecentColors(null)).toEqual([]);
    expect(parseRecentColors("{")).toEqual([]);
    expect(parseRecentColors('{"colors":[]}')).toEqual([]);
    expect(parseRecentColors("[1, 2]")).toEqual([]);
    expect(parseRecentColors('["#FF0000", "nope", "#00ff00", "#f00"]')).toEqual(
      ["#ff0000", "#00ff00"]
    );
    const tooMany = JSON.stringify(
      Array.from({ length: 30 }, (_, index) => hexOf(index))
    );
    expect(parseRecentColors(tooMany)).toEqual(
      Array.from({ length: MAX_RECENT_COLORS }, (_, index) => hexOf(index))
    );
  });

  it("remembers colours in storage", () => {
    const storage = memoryStorage({ [RECENT_COLORS_KEY]: "garbage" });
    expect(loadRecentColors(storage)).toEqual([]);
    rememberRecentColor("#123456", storage);
    expect(rememberRecentColor("#abcdef", storage)).toEqual([
      "#abcdef",
      "#123456",
    ]);
    expect(loadRecentColors(storage)).toEqual(["#abcdef", "#123456"]);
    expect(loadRecentColors()).toEqual([]);
  });

  it("carries on when storage refuses", () => {
    const broken = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("full");
      },
    } as unknown as Storage;
    expect(loadRecentColors(broken)).toEqual([]);
    expect(rememberRecentColor("#123456", broken)).toEqual(["#123456"]);
  });
});
