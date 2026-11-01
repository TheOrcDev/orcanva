import { describe, expect, it } from "vitest";

import {
  snapBox,
  snapPoint,
  snapResize,
  unionRect,
} from "@/lib/editor/snapping";

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

describe("equal spacing", () => {
  const left = { height: 100, width: 100, x: 0, y: 0 };
  const right = { height: 100, width: 100, x: 300, y: 0 };

  it("centres a box between its neighbours and marks both gaps", () => {
    const box = { height: 60, width: 100, x: 147, y: 20 };
    const result = snapBox(box, [left, right], 6);
    expect(result.dx).toBe(3);
    const gaps = result.guides.filter((guide) => guide.gap);
    expect(gaps).toEqual([
      { at: 50, axis: "y", from: 100, gap: true, to: 150 },
      { at: 50, axis: "y", from: 250, gap: true, to: 300 },
    ]);
  });

  it("repeats the gap between two neighbours on one side", () => {
    const pair = [left, { ...right, x: 150 }];
    // Gap of 50 between them, so the next one starts at 300
    const box = { height: 100, width: 100, x: 296, y: 0 };
    const result = snapBox(box, pair, 6);
    expect(result.dx).toBe(4);
    expect(result.guides.filter((guide) => guide.gap)).toHaveLength(2);
  });

  it("only counts neighbours in the same row", () => {
    const box = { height: 60, width: 100, x: 147, y: 400 };
    expect(snapBox(box, [left, right], 6).dx).toBe(0);
  });
});

describe("snapResize", () => {
  const target = { height: 100, width: 100, x: 500, y: 300 };
  const box = { height: 100, width: 200, x: 100, y: 100 };

  it("snaps only the edge a side handle moves", () => {
    const result = snapResize({
      anchor: "middle-right",
      box,
      distance: 6,
      keepRatio: false,
      point: { x: 497, y: 302 },
      targets: [target],
    });
    expect(result.point).toEqual({ x: 500, y: 302 });
    expect(result.guides).toEqual([{ at: 500, axis: "x", from: 100, to: 400 }]);
  });

  it("snaps both axes of a free corner", () => {
    const result = snapResize({
      anchor: "bottom-right",
      box,
      distance: 6,
      keepRatio: false,
      point: { x: 503, y: 296 },
      targets: [target],
    });
    expect(result.point).toEqual({ x: 500, y: 300 });
    expect(result.guides).toHaveLength(2);
  });

  it("keeps the ratio by sliding the other axis along the diagonal", () => {
    const result = snapResize({
      anchor: "bottom-right",
      box,
      distance: 6,
      keepRatio: true,
      point: { x: 498, y: 260 },
      targets: [target],
    });
    // Width 400 from x = 100 at ratio 1:2 is height 200 from y = 100
    expect(result.point).toEqual({ x: 500, y: 300 });
    const fromTop = snapResize({
      anchor: "top-left",
      box,
      distance: 6,
      keepRatio: true,
      point: { x: 52, y: 53 },
      targets: [{ height: 10, width: 10, x: 0, y: 40 }],
    });
    // y snaps to the target's bottom edge; height 150 at 1:2 is width 300
    expect(fromTop.point).toEqual({ x: 0, y: 50 });
  });

  it("leaves the handle alone when nothing is close", () => {
    const point = { x: 420, y: 250 };
    expect(
      snapResize({
        anchor: "bottom-right",
        box,
        distance: 6,
        keepRatio: true,
        point,
        targets: [target],
      })
    ).toEqual({ guides: [], point });
  });
});

describe("snapPoint", () => {
  it("snaps a point to lines on both axes", () => {
    const result = snapPoint(
      { x: 102, y: 197 },
      [{ height: 0, width: 0, x: 100, y: 200 }],
      6
    );
    expect(result).toMatchObject({ dx: -2, dy: 3 });
    expect(result.guides).toHaveLength(2);
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
