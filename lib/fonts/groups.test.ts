import { describe, expect, it } from "vitest";

import { FONT_CATALOG, getFont } from "@/lib/fonts/catalog";
import { BRAND_FONTS_LABEL, fontGroups } from "@/lib/fonts/groups";

describe("fontGroups", () => {
  it("lists every catalog font once by category without a brand kit", () => {
    const groups = fontGroups();
    expect(groups.map((group) => group.value)).toEqual([
      "Display",
      "Sans serif",
      "Serif",
      "Monospace",
      "Script",
    ]);
    const fonts = groups.flatMap((group) => group.items);
    expect(fonts).toHaveLength(FONT_CATALOG.length);
    expect(new Set(fonts).size).toBe(FONT_CATALOG.length);
  });

  it("puts brand fonts on top, in kit order, and keeps them in their category", () => {
    const [brand, display] = fontGroups(["inter", "anton", "inter"]);
    expect(brand?.value).toBe(BRAND_FONTS_LABEL);
    expect(brand?.items.map((font) => font.id)).toEqual(["inter", "anton"]);
    // The same object, so the picker shows it as chosen in both places
    expect(brand?.items[1]).toBe(getFont("anton"));
    expect(display?.items).toContain(getFont("anton"));
  });

  it("skips brand fonts the catalog doesn't have", () => {
    expect(fontGroups(["gone-font"])[0]?.value).toBe("Display");
  });
});
