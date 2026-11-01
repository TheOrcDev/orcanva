import { describe, expect, it } from "vitest";

import {
  createBoxElement,
  createDocument,
  createImageElement,
  createLinearElement,
  createTextElement,
} from "@/lib/document/factories";
import type { DesignDocument, TextElement } from "@/lib/document/schema";
import {
  bakeBoxTransform,
  bakeLineTransform,
  cropToEdge,
  edgeOfAnchor,
  bakeTextTransform,
  normalizeRotation,
} from "@/lib/editor/bake";
import {
  arrangeElement,
  duplicateElements,
  moveElementTo,
  removeElements,
  resizeDocument,
  updateElement,
} from "@/lib/editor/document-ops";

const PAGE = { height: 720, width: 1280 };

const withElements = (count: number): DesignDocument => {
  const document = createDocument(PAGE);
  for (let index = 0; index < count; index += 1) {
    document.elements.push({
      ...createBoxElement("rect", PAGE),
      name: `R${index}`,
    });
  }
  return document;
};

const names = (document: DesignDocument) =>
  document.elements.map((element) => element.name);

describe("document ops", () => {
  it("updates one element immutably and skips unknown ids", () => {
    const document = withElements(2);
    const [first] = document.elements;
    if (!first) {
      throw new Error("missing element");
    }
    const next = updateElement(document, first.id, { x: 99 });
    expect(next.elements[0]?.x).toBe(99);
    expect(document.elements[0]?.x).not.toBe(99);
    expect(updateElement(document, "nope", { x: 1 })).toBe(document);
  });

  it("returns the same document when a patch changes nothing", () => {
    // e.g. a field committing the same value twice (Enter, then blur)
    const document = withElements(1);
    const [first] = document.elements;
    expect(updateElement(document, first?.id ?? "", { x: first?.x })).toBe(
      document
    );
  });

  it("arranges z-order in every direction", () => {
    const document = withElements(4);
    const id = document.elements[1]?.id ?? "";

    expect(names(arrangeElement(document, id, "forward"))).toEqual([
      "R0",
      "R2",
      "R1",
      "R3",
    ]);
    expect(names(arrangeElement(document, id, "backward"))).toEqual([
      "R1",
      "R0",
      "R2",
      "R3",
    ]);
    expect(names(arrangeElement(document, id, "front"))).toEqual([
      "R0",
      "R2",
      "R3",
      "R1",
    ]);
    expect(names(arrangeElement(document, id, "back"))).toEqual([
      "R1",
      "R0",
      "R2",
      "R3",
    ]);
    expect(moveElementTo(document, id, 99).elements.at(-1)?.id).toBe(id);
  });

  it("duplicates directly above the original and removes by id", () => {
    const document = withElements(2);
    const id = document.elements[0]?.id ?? "";
    const result = duplicateElements(document, [id]);
    expect(names(result.document)).toEqual(["R0", "R0 copy", "R1"]);
    expect(result.ids).toHaveLength(1);
    expect(names(removeElements(result.document, [id, ...result.ids]))).toEqual(
      ["R1"]
    );
  });

  it("resizes the canvas with and without scaling content", () => {
    const document = createDocument(PAGE);
    document.elements.push(
      { ...createBoxElement("rect", PAGE), height: 100, width: 100, x: 100 },
      createLinearElement("line", PAGE),
      createTextElement("heading", PAGE)
    );
    const target = { height: 1080, width: 1920 };

    const kept = resizeDocument(document, target, false);
    expect(kept.width).toBe(1920);
    expect(kept.elements).toBe(document.elements);

    const scaled = resizeDocument(document, target, true);
    expect(scaled.elements[0]).toMatchObject({
      height: 150,
      width: 150,
      x: 150,
    });
    const text = scaled.elements[2] as TextElement;
    const original = document.elements[2] as TextElement;
    expect(text.fontSize).toBeCloseTo(original.fontSize * 1.5);
  });
});

describe("transform baking", () => {
  it("normalizes rotation into (-180, 180]", () => {
    expect(normalizeRotation(370)).toBe(10);
    expect(normalizeRotation(-190)).toBe(170);
    expect(normalizeRotation(360)).toBe(0);
  });

  it("bakes box scale into width/height and keeps a minimum size", () => {
    const rect = { ...createBoxElement("rect", PAGE), height: 100, width: 200 };
    const baked = bakeBoxTransform(rect, {
      rotation: 45,
      scaleX: 1.5,
      scaleY: 0.01,
      x: 10,
      y: 20,
    });
    expect(baked).toMatchObject({
      height: 4,
      rotation: 45,
      width: 300,
      x: 10,
      y: 20,
    });
  });

  it("scales font size on corner drags and only width on side drags", () => {
    const text = { ...createTextElement("heading", PAGE), fontSize: 100 };
    const corner = bakeTextTransform(
      text,
      { rotation: 0, scaleX: 2, scaleY: 2, x: 0, y: 0 },
      text.width
    );
    expect(corner.fontSize).toBe(200);
    expect(corner.width).toBe(text.width * 2);

    const side = bakeTextTransform(
      text,
      { rotation: 0, scaleX: 1, scaleY: 1, x: 5, y: 0 },
      321
    );
    expect(side.fontSize).toBe(100);
    expect(side.width).toBe(321);
  });
});

describe("bakeLineTransform", () => {
  it("folds a turn and a scale into the points and the stroke", () => {
    const line = {
      ...createLinearElement("line", PAGE),
      points: [0, 0, 100, 0] as [number, number, number, number],
      strokeWidth: 4,
    };
    const baked = bakeLineTransform(line, {
      rotation: 90,
      scaleX: 2,
      scaleY: 2,
      x: 10,
      y: 20,
    });
    expect(baked.x).toBe(10);
    expect(baked.y).toBe(20);
    expect(baked.rotation).toBe(0);
    expect(baked.strokeWidth).toBe(8);
    const [x1, y1, x2, y2] = baked.points;
    expect([x1, y1]).toEqual([0, 0]);
    expect(x2).toBeCloseTo(0);
    expect(y2).toBeCloseTo(200);
  });
});

describe("cropToEdge", () => {
  const ASSET = {
    height: 600,
    id: "8a5b3f4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
    width: 800,
  };
  const photo = { ...createImageElement(ASSET, PAGE), height: 300, width: 400 };

  it("crops the side that moves and stops at the photo's edge", () => {
    expect(cropToEdge(photo, "right", 300)).toEqual({
      crop: { height: 1, width: 0.75, x: 0, y: 0 },
      size: 300,
    });
    const left = cropToEdge(photo, "left", 100);
    expect(left.crop).toEqual({ height: 1, width: 0.25, x: 0.75, y: 0 });
    // Back out past the edge: the whole photo, no further
    const cropped = { ...photo, crop: left.crop, width: 100 };
    expect(cropToEdge(cropped, "left", 900)).toEqual({ crop: null, size: 400 });
    expect(edgeOfAnchor("top-center")).toBe("top");
    expect(edgeOfAnchor("top-left")).toBeNull();
  });

  it("crops the mirrored side of a flipped photo", () => {
    const flipped = { ...photo, flipX: true };
    expect(cropToEdge(flipped, "right", 100).crop).toEqual({
      height: 1,
      width: 0.25,
      x: 0.75,
      y: 0,
    });
  });
});
