import { describe, expect, it } from "vitest";

import { snapBox, unionRect } from "@/lib/editor/snapping";

const PAGE = { height: 720, width: 1280, x: 0, y: 0 };

describe("snapBox", () => {
  it("snaps a centre to the page centre and spans the page", () => {
    const box = { height: 100, width: 200, x: 537, y: 300 };
    const result = snapBox(box, [PAGE], 6);
    expect(result.dx).toBe(3);
    expect(result.dy).toBe(0);
    expect(result.guides).toContainEqual({
      at: 640,
      axis: "x",
      from: 0,
      to: 720,
    });
  });

  it("snaps an edge to another element's opposite edge", () => {
    const target = { height: 50, width: 100, x: 100, y: 500 };
    const box = { height: 50, width: 100, x: 204, y: 400 };
    const result = snapBox(box, [target], 6);
    expect(result.dx).toBe(-4);
    expect(result.guides).toContainEqual({
      at: 200,
      axis: "x",
      from: 400,
      to: 550,
    });
  });

  it("picks the nearest line on each axis on its own", () => {
    const targets = [
      { height: 10, width: 10, x: 105, y: 0 },
      { height: 10, width: 10, x: 0, y: 300 },
    ];
    const box = { height: 10, width: 10, x: 103, y: 296 };
    const result = snapBox(box, targets, 6);
    expect(result.dx).toBe(2);
    expect(result.dy).toBe(-1);
  });

  it("leaves boxes alone when nothing is close enough", () => {
    const box = { height: 100, width: 100, x: 300, y: 300 };
    expect(snapBox(box, [PAGE], 6)).toEqual({ dx: 0, dy: 0, guides: [] });
  });

  it("merges guides from several targets on the same line", () => {
    const targets = [
      { height: 10, width: 10, x: 100, y: 0 },
      { height: 10, width: 10, x: 100, y: 500 },
    ];
    const box = { height: 10, width: 10, x: 101, y: 200 };
    const { guides } = snapBox(box, targets, 6);
    expect(guides.filter((guide) => guide.axis === "x")).toEqual([
      { at: 100, axis: "x", from: 0, to: 510 },
      { at: 105, axis: "x", from: 0, to: 510 },
      { at: 110, axis: "x", from: 0, to: 510 },
    ]);
  });
});

describe("unionRect", () => {
  it("covers every box", () => {
    expect(
      unionRect([
        { height: 10, width: 10, x: 0, y: 0 },
        { height: 10, width: 10, x: 20, y: 30 },
      ])
    ).toEqual({ height: 40, width: 30, x: 0, y: 0 });
    expect(unionRect([])).toBeNull();
  });
});
