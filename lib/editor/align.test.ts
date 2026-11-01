import { describe, expect, it } from "vitest";

import { createBoxElement, createDocument } from "@/lib/document/factories";
import type { DesignDocument } from "@/lib/document/schema";
import { alignUnits, distributeUnits } from "@/lib/editor/align";
import { arrangeElements } from "@/lib/editor/document-ops";

const PAGE = { height: 720, width: 1280 };

const box = (id: string, x: number, y: number, width = 100, height = 100) => ({
  ...createBoxElement("rect", PAGE),
  height,
  id,
  width,
  x,
  y,
});

const documentOf = (...elements: ReturnType<typeof box>[]): DesignDocument => ({
  ...createDocument(PAGE),
  elements,
});

// Unrotated boxes measure as their own geometry
const unitsOf = (document: DesignDocument) =>
  document.elements.map((element) => ({
    box: {
      height: element.type === "rect" ? element.height : 0,
      width: element.type === "rect" ? element.width : 0,
      x: element.x,
      y: element.y,
    },
    ids: [element.id],
  }));

const positions = (document: DesignDocument) =>
  document.elements.map((element) => [element.x, element.y]);

describe("alignUnits", () => {
  const document = documentOf(box("a", 10, 10), box("b", 200, 50, 50, 50));
  const selection = { height: 100, width: 240, x: 10, y: 10 };

  it("lines units up with an edge of the reference box", () => {
    expect(
      positions(alignUnits(document, unitsOf(document), "left", selection))
    ).toEqual([
      [10, 10],
      [10, 50],
    ]);
    expect(
      positions(alignUnits(document, unitsOf(document), "bottom", selection))
    ).toEqual([
      [10, 10],
      [200, 60],
    ]);
  });

  it("centres units on the page", () => {
    const page = { height: 720, width: 1280, x: 0, y: 0 };
    expect(
      positions(alignUnits(document, unitsOf(document), "center", page))
    ).toEqual([
      [590, 10],
      [615, 50],
    ]);
  });

  it("moves every element of a unit together", () => {
    const pair = documentOf(box("a", 0, 0), box("b", 100, 0));
    const unit = {
      box: { height: 100, width: 200, x: 0, y: 0 },
      ids: ["a", "b"],
    };
    const reference = { height: 100, width: 400, x: 0, y: 0 };
    expect(positions(alignUnits(pair, [unit], "right", reference))).toEqual([
      [200, 0],
      [300, 0],
    ]);
  });
});

describe("distributeUnits", () => {
  it("spaces units evenly between the outermost two", () => {
    const document = documentOf(
      box("a", 0, 0),
      box("b", 120, 0, 50),
      box("c", 400, 0)
    );
    const spaced = distributeUnits(document, unitsOf(document), "x");
    // 500 wide with 250 taken leaves two gaps of 125
    expect(positions(spaced)).toEqual([
      [0, 0],
      [225, 0],
      [400, 0],
    ]);
  });

  it("needs at least three", () => {
    const document = documentOf(box("a", 0, 0), box("b", 300, 0));
    expect(distributeUnits(document, unitsOf(document), "x")).toBe(document);
  });
});

const ids = (document: DesignDocument) =>
  document.elements.map((element) => element.id);

describe("arrangeElements", () => {
  const stack = documentOf(
    box("a", 0, 0),
    box("b", 0, 0),
    box("c", 0, 0),
    box("d", 0, 0)
  );

  it("brings a block forward one step, keeping its order", () => {
    expect(ids(arrangeElements(stack, ["a", "b"], "forward"))).toEqual([
      "c",
      "a",
      "b",
      "d",
    ]);
    expect(ids(arrangeElements(stack, ["c", "d"], "backward"))).toEqual([
      "a",
      "c",
      "d",
      "b",
    ]);
  });

  it("moves scattered elements to an end of the stack", () => {
    expect(ids(arrangeElements(stack, ["a", "c"], "front"))).toEqual([
      "b",
      "d",
      "a",
      "c",
    ]);
    expect(ids(arrangeElements(stack, ["b", "d"], "back"))).toEqual([
      "b",
      "d",
      "a",
      "c",
    ]);
  });

  it("returns the same document when nothing can move", () => {
    expect(arrangeElements(stack, ["d"], "forward")).toBe(stack);
  });
});
