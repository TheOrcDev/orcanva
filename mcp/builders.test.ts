import { describe, expect, it } from "vitest";

import { findBuiltinGraphic } from "@/lib/graphics/builtin";

import {
  buildBox,
  buildGraphic,
  buildImage,
  buildLine,
  buildText,
  elementSpec,
  patchElement,
  placeBox,
  summarizeElement,
  toBackground,
} from "./builders";
import type { TextSpec } from "./builders";

const PAGE = { height: 720, width: 1280 };
const ASSET = {
  height: 500,
  id: "6f1c1b7a-3f6a-4f3e-9a51-0e9f2d2b8c11",
  width: 1000,
};

const text = (spec: Omit<TextSpec, "type">) =>
  buildText(elementSpec.parse({ ...spec, type: "text" }) as TextSpec, PAGE);

describe("buildText", () => {
  it("applies the friendly style fields", () => {
    const element = text({
      color: "#ffffff",
      font: "bebas-neue",
      fontSize: 120,
      outline: { color: "#000000" },
      shadow: {},
      text: "Big title",
      uppercase: true,
    });
    expect(element).toMatchObject({
      fill: "#ffffff",
      fontId: "bebas-neue",
      fontSize: 120,
      stroke: { color: "#000000", widthEm: 0.05 },
      text: "Big title",
      type: "text",
      uppercase: true,
    });
    expect(element.type === "text" && element.shadow).toBeTruthy();
  });

  it("centres by default and honours explicit x/y", () => {
    const centred = text({ text: "Hi" });
    expect(centred.x).toBeCloseTo((PAGE.width - PAGE.width * 0.8) / 2);
    const placed = text({ text: "Hi", x: 10, y: 20 });
    expect(placed).toMatchObject({ x: 10, y: 20 });
  });

  it("rejects unknown fonts and unknown advanced fields", () => {
    expect(() => text({ font: "comic-sans", text: "Hi" })).toThrow(
      /Unknown font/u
    );
    expect(() => text({ advanced: { colour: "#fff" }, text: "Hi" })).toThrow(
      /Unknown field/u
    );
  });

  it("passes known advanced fields through", () => {
    const element = text({ advanced: { curve: 40 }, text: "Hi" });
    expect(element.type === "text" && element.curve).toBe(40);
  });
});

describe("placement", () => {
  it("puts boxes in the corners with a margin", () => {
    const size = { height: 100, width: 200 };
    expect(placeBox("top-left", size, PAGE)).toEqual({ x: 36, y: 36 });
    expect(placeBox("bottom-right", size, PAGE)).toEqual({
      x: 1280 - 200 - 36,
      y: 720 - 100 - 36,
    });
  });

  it("places a box by keyword", () => {
    const box = buildBox(
      { height: 100, place: "top-right", type: "rect", width: 200 },
      PAGE
    );
    expect(box).toMatchObject({ x: 1280 - 200 - 36, y: 36 });
  });
});

describe("shapes, lines, graphics and images", () => {
  it("builds a line from two points", () => {
    const line = buildLine(
      { type: "arrow", x1: 100, x2: 400, y1: 50, y2: 150 },
      PAGE
    );
    expect(line).toMatchObject({
      points: [0, 0, 300, 100],
      type: "arrow",
      x: 100,
      y: 50,
    });
  });

  it("sizes a graphic by its longer side and recolours it", () => {
    const entry = findBuiltinGraphic("sticker:arrow-bold");
    if (!entry) {
      throw new Error("missing builtin");
    }
    const graphic = buildGraphic(
      { colors: ["#00ff00"], graphic: entry.id, size: 300, type: "graphic" },
      entry,
      PAGE
    );
    if (graphic.type !== "graphic") {
      throw new Error("not a graphic");
    }
    expect(Math.max(graphic.width, graphic.height)).toBeCloseTo(300);
    expect(graphic.palette[0]).toBe("#00ff00");
    expect(summarizeElement(graphic).layers).toMatch(/vector layers/u);
  });

  it("keeps an image's aspect when given one side", () => {
    const image = buildImage(
      { source: "/tmp/x.png", type: "image", width: 400 },
      ASSET,
      PAGE
    );
    expect(image).toMatchObject({ assetId: ASSET.id, height: 200, width: 400 });
  });
});

describe("patchElement", () => {
  it("changes fields and refuses id/type changes and bad values", () => {
    const box = buildBox({ type: "rect" }, PAGE);
    expect(patchElement(box, { fill: "#123456" })).toMatchObject({
      fill: "#123456",
      id: box.id,
    });
    expect(() => patchElement(box, { type: "ellipse" })).toThrow(/type/u);
    expect(() => patchElement(box, { opacity: 5 })).toThrow();
    expect(() => patchElement(box, { fontSize: 5 })).toThrow(/Unknown field/u);
  });
});

describe("toBackground", () => {
  it("spreads gradient stops evenly", () => {
    expect(
      toBackground({ gradient: { colors: ["#000", "#888", "#fff"] } })
    ).toEqual({
      angle: 90,
      stops: [
        { color: "#000", offset: 0 },
        { color: "#888", offset: 0.5 },
        { color: "#fff", offset: 1 },
      ],
      type: "linear",
    });
  });
});
