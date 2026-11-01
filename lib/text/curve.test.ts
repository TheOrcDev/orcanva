import { describe, expect, it } from "vitest";

import { curveText } from "@/lib/text/curve";
import type { Measurer } from "@/lib/text/layout";

const measure: Measurer = {
  fontBox: (style) => ({
    ascent: style.fontSize * 0.8,
    descent: style.fontSize * 0.2,
  }),
  width: (text, style) => [...text].length * style.fontSize * 0.5,
};
const style = { font: "20px Test", fontSize: 20, letterSpacing: 0 };

describe("curveText", () => {
  it("lays straight text out on one line when not curved", () => {
    const layout = curveText([{ style, text: "ab\ncd" }], 0, measure);
    expect(layout.glyphs.map((glyph) => glyph.text).join("")).toBe("ab cd");
    expect(layout.width).toBeCloseTo(50);
    expect(layout.height).toBeCloseTo(20);
    expect(new Set(layout.glyphs.map((glyph) => glyph.y)).size).toBe(1);
  });

  it("arches up for positive curves and dips for negative ones", () => {
    const up = curveText([{ style, text: "abcdefg" }], 50, measure);
    const { 0: first, 3: middle } = up.glyphs;
    // The middle letter sits higher than the ends, leaning outwards
    expect(middle?.y).toBeLessThan(first?.y ?? 0);
    expect(first?.rotation).toBeLessThan(0);
    const down = curveText([{ style, text: "abcdefg" }], -50, measure);
    expect(down.glyphs[3]?.y).toBeGreaterThan(down.glyphs[0]?.y ?? 0);
    expect(down.glyphs[0]?.rotation).toBeGreaterThan(0);
  });

  it("boxes every glyph from 0, 0", () => {
    const layout = curveText([{ style, text: "curve me" }], 80, measure);
    for (const glyph of layout.glyphs) {
      expect(glyph.x).toBeGreaterThanOrEqual(0);
      expect(glyph.y).toBeGreaterThanOrEqual(0);
      expect(glyph.x).toBeLessThanOrEqual(layout.width);
    }
  });
});
