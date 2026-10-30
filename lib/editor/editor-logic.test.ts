import { describe, expect, it } from "vitest";

import {
  createBoxElement,
  createDocument,
  createLinearElement,
  createTextElement,
} from "@/lib/document/factories";
import type { DesignDocument, TextElement } from "@/lib/document/schema";
import {
  bakeBoxTransform,
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
