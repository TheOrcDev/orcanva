import { describe, expect, it } from "vitest";

import { createDocument, createGraphicElement } from "@/lib/document/factories";
import { documentColors } from "@/lib/document/palette";
import type { GraphicElement } from "@/lib/document/schema";
import { bakeBoxTransform } from "@/lib/editor/bake";
import { resizeDocument } from "@/lib/editor/document-ops";
import { BUILTIN_GRAPHICS } from "@/lib/graphics/builtin";
import { artTransform, outlineReach } from "@/lib/graphics/draw";
import { MAX_GRAPHIC_JSON_LENGTH } from "@/lib/graphics/entry";
import type { GraphicEntry } from "@/lib/graphics/entry";
import { paintedIndexes } from "@/lib/graphics/paint";

const PAGE = { height: 720, width: 1280 };

// A wide piece of art, 3:1
const WIDE: GraphicEntry = {
  id: "test:wide",
  kind: "icon",
  layers: [
    {
      d: "M0 0H30V10H0Z",
      fill: 0,
      fillRule: "nonzero",
      lineCap: "butt",
      lineJoin: "miter",
      opacity: 1,
      stroke: null,
      strokeWidth: 0,
    },
  ],
  name: "Wide",
  palette: ["#111111"],
  viewBox: [0, 0, 30, 10],
};

describe("built-in stickers", () => {
  it("are small enough to carry in an element, with unique ids", () => {
    for (const graphic of BUILTIN_GRAPHICS) {
      expect(JSON.stringify(graphic).length).toBeLessThan(
        MAX_GRAPHIC_JSON_LENGTH
      );
      expect(graphic.kind).toBe("sticker");
      expect(graphic.keywords.length).toBeGreaterThan(0);
    }
    const ids = BUILTIN_GRAPHICS.map((graphic) => graphic.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("createGraphicElement", () => {
  it("fits the art at a quarter of the page's shorter side, centred", () => {
    const graphic = createGraphicElement(WIDE, PAGE);
    expect(graphic).toMatchObject({
      height: 60,
      kind: "icon",
      name: "Wide",
      source: "test:wide",
      strokeScale: 1,
      type: "graphic",
      width: 180,
      x: 550,
      y: 330,
    });
  });

  it("centres a dropped graphic on the drop point", () => {
    const graphic = createGraphicElement(WIDE, PAGE, { x: 100, y: 200 });
    expect(graphic).toMatchObject({ x: 10, y: 170 });
  });

  it("gives each element its own palette to recolour", () => {
    const graphic = createGraphicElement(WIDE, PAGE);
    expect(graphic.palette).toEqual(WIDE.palette);
    expect(graphic.palette).not.toBe(WIDE.palette);
  });
});

describe("resizing graphics", () => {
  const graphic: GraphicElement = {
    ...createGraphicElement(WIDE, PAGE),
    height: 100,
    width: 300,
    x: 100,
    y: 100,
  };

  it("scales them evenly with the page's content, about their centres", () => {
    const document = { ...createDocument(PAGE), elements: [graphic] };
    // 2× wide, 1.5× tall: the art grows by the smaller and keeps its shape
    const [scaled] = resizeDocument(
      document,
      { height: 1080, width: 2560 },
      true
    ).elements;
    expect(scaled).toMatchObject({
      height: 150,
      width: 450,
      x: 275,
      y: 150,
    });
  });

  it("bakes a corner drag into the box, outline untouched", () => {
    const outlined = { ...graphic, outline: { color: "#fff", width: 0.1 } };
    const baked = bakeBoxTransform(outlined, {
      rotation: 0,
      scaleX: 2,
      scaleY: 2,
      x: 5,
      y: 6,
    });
    expect(baked).toMatchObject({
      height: 200,
      outline: { color: "#fff", width: 0.1 },
      width: 600,
      x: 5,
      y: 6,
    });
  });
});

describe("drawing graphics", () => {
  it("maps the viewBox onto the box, mirrored inside it", () => {
    const box = { height: 50, width: 100 };
    expect(artTransform([10, 20, 50, 25], box, false, false)).toEqual([
      2, 0, 0, 2, -20, -40,
    ]);
    // Flipped, the viewBox's left edge lands on the box's right edge
    const flipped = artTransform([10, 20, 50, 25], box, true, true);
    expect(flipped).toEqual([-2, 0, 0, -2, 120, 90]);
    expect(-2 * 10 + 120).toBe(box.width);
    expect(-2 * 20 + 90).toBe(box.height);
  });

  it("measures the outline from the art's shorter side", () => {
    expect(
      outlineReach({
        outline: { color: "#fff", width: 0.1 },
        viewBox: [0, 0, 30, 10],
      })
    ).toBeCloseTo(1);
    expect(outlineReach({ outline: null, viewBox: [0, 0, 30, 10] })).toBe(0);
  });
});

describe("graphic colours", () => {
  const [layer] = WIDE.layers;
  if (!layer) {
    throw new Error("No layer");
  }
  const graphic: GraphicElement = {
    ...createGraphicElement(WIDE, PAGE),
    layers: [
      { ...layer, fill: 2 },
      { ...layer, fill: null, stroke: 0, strokeWidth: 2 },
      // Paints nothing: a stroke with no width, and an invisible layer
      { ...layer, fill: null, stroke: 1, strokeWidth: 0 },
      { ...layer, fill: 3, opacity: 0 },
      // Past the palette's end
      { ...layer, fill: 9 },
      { ...layer, fill: 2 },
    ],
    palette: ["#ff0000", "#00ff00", "#0000ff", "#ffff00"],
  };

  it("lists the palette entries that paint, in the order they're used", () => {
    expect(paintedIndexes(graphic)).toEqual([2, 0]);
  });

  it("offers each painted colour once, and the outline", () => {
    const document = {
      ...createDocument(PAGE),
      elements: [
        graphic,
        { ...graphic, id: "g2", outline: { color: "#123456", width: 0.1 } },
        { ...graphic, id: "g3", outline: { color: "#abcdef", width: 0 } },
      ],
    };
    expect(documentColors(document)).toEqual([
      "#0000ff",
      "#ff0000",
      "#ffffff",
      "#123456",
    ]);
  });
});
