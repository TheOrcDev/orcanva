import { describe, expect, it } from "vitest";

import { createGraphicElement } from "@/lib/document/factories";
import type { GraphicElement, GraphicLayer } from "@/lib/document/schema";
import {
  DEFAULT_GRAPHIC_OUTLINE,
  clampStrokeScale,
  hasStrokes,
  maxOutlinePx,
  outlineAtPx,
  outlinePx,
  paletteSwatches,
  resetColorsPatch,
  withPaletteColor,
} from "@/lib/editor/graphic-ops";

const PAGE = { height: 720, width: 1280 };

const layer = (fields: Partial<GraphicLayer>): GraphicLayer => ({
  d: "M0 0h10v10z",
  fill: null,
  fillRule: "nonzero",
  lineCap: "butt",
  lineJoin: "miter",
  opacity: 1,
  stroke: null,
  strokeWidth: 0,
  ...fields,
});

// A 40 × 20 piece of art drawn 200 × 100
const graphic = (fields: Partial<GraphicElement> = {}): GraphicElement => ({
  ...createGraphicElement(
    {
      id: "test:art",
      kind: "emoji",
      layers: [
        layer({ fill: 1 }),
        layer({ fill: 0 }),
        layer({ fill: 1 }),
        // An entry nothing paints with shows no swatch
        layer({ stroke: 2, strokeWidth: 0 }),
      ],
      name: "Art",
      palette: ["#ff0000", "#00ff00", "#0000ff"],
      viewBox: [0, 0, 40, 20],
    },
    PAGE
  ),
  height: 100,
  width: 200,
  ...fields,
});

describe("graphic colours", () => {
  it("offers a swatch per colour the art paints with, in order of use", () => {
    expect(paletteSwatches(graphic())).toEqual([
      { color: "#00ff00", index: 1 },
      { color: "#ff0000", index: 0 },
    ]);
  });

  it("recolours every layer sharing a palette entry at once", () => {
    const art = graphic();
    const patch = withPaletteColor(art, 1, "#123456");
    expect(patch).toEqual({ palette: ["#ff0000", "#123456", "#0000ff"] });
    // The element's own palette is left as it was
    expect(art.palette[1]).toBe("#00ff00");
  });

  it("resets to the art's own palette, and does nothing when it's there", () => {
    const original = { palette: ["#ff0000", "#00ff00", "#0000ff"] };
    const recoloured = graphic({ palette: ["#ffffff", "#00ff00", "#0000ff"] });
    expect(resetColorsPatch(recoloured, original)).toEqual({
      palette: ["#ff0000", "#00ff00", "#0000ff"],
    });
    expect(resetColorsPatch(graphic(), original)).toBeNull();
  });
});

describe("line weight", () => {
  it("only counts layers that draw a line", () => {
    expect(hasStrokes(graphic())).toBe(false);
    const outlined = graphic({
      layers: [layer({ stroke: 0, strokeWidth: 2 })],
    });
    expect(hasStrokes(outlined)).toBe(true);
    expect(
      hasStrokes(
        graphic({ layers: [layer({ opacity: 0, stroke: 0, strokeWidth: 2 })] })
      )
    ).toBe(false);
  });

  it("stays between a quarter and four times the art's own", () => {
    expect(clampStrokeScale(0.1)).toBe(0.25);
    expect(clampStrokeScale(1.5)).toBe(1.5);
    expect(clampStrokeScale(9)).toBe(4);
  });
});

describe("graphic outline", () => {
  // The art is drawn at 5 px per viewBox unit; its shorter side is 20
  const outlined = graphic({ outline: { color: "#fff", width: 0.1 } });

  it("measures the outline in page px at the graphic's size", () => {
    expect(outlinePx(outlined)).toBeCloseTo(10);
    expect(maxOutlinePx(outlined)).toBeCloseTo(25);
    // Twice the size, twice the reach
    expect(outlinePx({ ...outlined, height: 200, width: 400 })).toBeCloseTo(20);
  });

  it("turns px from the slider back into a share of the art", () => {
    expect(outlineAtPx(outlined, 5)).toEqual({ color: "#fff", width: 0.05 });
    // Clamped to what the schema allows
    expect(outlineAtPx(outlined, 1000)?.width).toBe(0.25);
    expect(outlineAtPx(graphic(), 5)).toBeNull();
  });

  it("starts white, as a sticker's border", () => {
    expect(DEFAULT_GRAPHIC_OUTLINE.color).toBe("#ffffff");
    expect(DEFAULT_GRAPHIC_OUTLINE.width).toBeGreaterThan(0);
  });
});
