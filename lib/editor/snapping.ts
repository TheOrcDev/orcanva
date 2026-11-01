import type { Point, Rect } from "@/lib/document/geometry";

// Screen pixels within which a moving edge or centre snaps to a line
export const SNAP_DISTANCE_PX = 6;

// Lines closer than this (in page pixels) count as the same line
const SAME_LINE = 0.01;

export type SnapAxis = "x" | "y";

// A line drawn while something snaps: vertical at x = `at` for the x axis,
// horizontal at y = `at` for the y axis, from `from` to `to` along the other
export interface SnapGuide {
  axis: SnapAxis;
  at: number;
  from: number;
  to: number;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: SnapGuide[];
}

export const NO_SNAP: SnapResult = { dx: 0, dy: 0, guides: [] };

const startOf = (box: Rect, axis: SnapAxis) => (axis === "x" ? box.x : box.y);
const sizeOf = (box: Rect, axis: SnapAxis) =>
  axis === "x" ? box.width : box.height;
const other = (axis: SnapAxis): SnapAxis => (axis === "x" ? "y" : "x");

// Left, centre and right (or top, middle and bottom) of a box
const linesOf = (box: Rect, axis: SnapAxis): number[] => {
  const start = startOf(box, axis);
  const size = sizeOf(box, axis);
  return [start, start + size / 2, start + size];
};

// The smallest shift that puts one of the moving lines on a target line
const nearestShift = (
  box: Rect,
  targets: readonly Rect[],
  axis: SnapAxis,
  distance: number
): number | null => {
  let best: number | null = null;
  const moving = linesOf(box, axis);
  for (const target of targets) {
    for (const line of linesOf(target, axis)) {
      for (const edge of moving) {
        const shift = line - edge;
        if (
          Math.abs(shift) <= distance &&
          (best === null || Math.abs(shift) < Math.abs(best))
        ) {
          best = shift;
        }
      }
    }
  }
  return best;
};

// One guide per line the snapped box shares with a target, spanning both
const guidesFor = (
  box: Rect,
  targets: readonly Rect[],
  axis: SnapAxis
): SnapGuide[] => {
  const across = other(axis);
  const guides: SnapGuide[] = [];
  const moving = linesOf(box, axis);
  for (const target of targets) {
    for (const line of linesOf(target, axis)) {
      if (!moving.some((edge) => Math.abs(edge - line) < SAME_LINE)) {
        continue;
      }
      const from = Math.min(startOf(box, across), startOf(target, across));
      const to = Math.max(
        startOf(box, across) + sizeOf(box, across),
        startOf(target, across) + sizeOf(target, across)
      );
      const existing = guides.find(
        (guide) => Math.abs(guide.at - line) < SAME_LINE
      );
      if (existing) {
        existing.from = Math.min(existing.from, from);
        existing.to = Math.max(existing.to, to);
      } else {
        guides.push({ at: line, axis, from, to });
      }
    }
  }
  return guides;
};

export const offsetRect = (box: Rect, offset: Point): Rect => ({
  ...box,
  x: box.x + offset.x,
  y: box.y + offset.y,
});

// Snaps a moving box's edges and centre to the same lines of the targets
// (other elements and the page), each axis on its own. `distance` is in
// page pixels, so callers divide the screen distance by the zoom.
export const snapBox = (
  box: Rect,
  targets: readonly Rect[],
  distance: number
): SnapResult => {
  const dx = nearestShift(box, targets, "x", distance) ?? 0;
  const dy = nearestShift(box, targets, "y", distance) ?? 0;
  const snapped = offsetRect(box, { x: dx, y: dy });
  return {
    dx,
    dy,
    guides: [
      ...guidesFor(snapped, targets, "x"),
      ...guidesFor(snapped, targets, "y"),
    ],
  };
};

// The smallest box around all of them
export const unionRect = (boxes: readonly Rect[]): Rect | null => {
  const [first, ...rest] = boxes;
  if (!first) {
    return null;
  }
  let left = first.x;
  let top = first.y;
  let right = first.x + first.width;
  let bottom = first.y + first.height;
  for (const box of rest) {
    left = Math.min(left, box.x);
    top = Math.min(top, box.y);
    right = Math.max(right, box.x + box.width);
    bottom = Math.max(bottom, box.y + box.height);
  }
  return { height: bottom - top, width: right - left, x: left, y: top };
};
