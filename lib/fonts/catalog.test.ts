import { describe, expect, it } from "vitest";

import {
  FONT_CATALOG,
  fontStylesheetUrl,
  getFont,
  nearestWeight,
} from "@/lib/fonts/catalog";

describe("font catalog", () => {
  it("has unique ids and sorted weights", () => {
    const ids = FONT_CATALOG.map((font) => font.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const font of FONT_CATALOG) {
      expect([...font.weights]).toEqual(
        [...font.weights].toSorted((a, b) => a - b)
      );
    }
  });

  it("falls back to the default font for unknown ids", () => {
    expect(getFont("does-not-exist").id).toBe("anton");
  });

  it("snaps to the nearest shipped weight", () => {
    expect(nearestWeight(getFont("anton"), 900)).toBe(400);
    expect(nearestWeight(getFont("lato"), 600)).toBe(700);
  });

  it("builds Google Fonts CSS2 urls with sorted axis tuples", () => {
    expect(fontStylesheetUrl(getFont("anton"))).toBe(
      "https://fonts.googleapis.com/css2?family=Anton&display=block"
    );
    expect(fontStylesheetUrl(getFont("space-mono"))).toBe(
      "https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400;1,700&display=block"
    );
    expect(fontStylesheetUrl(getFont("teko"))).toBe(
      "https://fonts.googleapis.com/css2?family=Teko:wght@300;400;500;600;700&display=block"
    );
  });
});
