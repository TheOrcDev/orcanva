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
  moving: readonly number[],
  targets: readonly Rect[],
  axis: SnapAxis,
  distance: number
): number | null => {
  let best: number | null = null;
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

// How far one moving line (e.g. an edge being resized) must shift to sit on
// a target line, or null when none is close enough
export const snapValue = (
  value: number,
  targets: readonly Rect[],
  axis: SnapAxis,
  distance: number
): number | null => nearestShift([value], targets, axis, distance);

// Guides for every target line that one of `lines` sits on. `span` is the
// moving thing's extent along the other axis; each guide covers it and the
// target.
export const guidesAt = (
  axis: SnapAxis,
  lines: readonly number[],
  span: { from: number; to: number },
  targets: readonly Rect[]
): SnapGuide[] => {
  const across = other(axis);
  const guides: SnapGuide[] = [];
  for (const target of targets) {
    for (const line of linesOf(target, axis)) {
      if (!lines.some((edge) => Math.abs(edge - line) < SAME_LINE)) {
        continue;
      }
      const from = Math.min(span.from, startOf(target, across));
      const to = Math.max(
        span.to,
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

const spanOf = (box: Rect, axis: SnapAxis) => ({
  from: startOf(box, axis),
  to: startOf(box, axis) + sizeOf(box, axis),
});

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
  const dx = nearestShift(linesOf(box, "x"), targets, "x", distance) ?? 0;
  const dy = nearestShift(linesOf(box, "y"), targets, "y", distance) ?? 0;
  const snapped = offsetRect(box, { x: dx, y: dy });
  return {
    dx,
    dy,
    guides: [
      ...guidesAt("x", linesOf(snapped, "x"), spanOf(snapped, "y"), targets),
      ...guidesAt("y", linesOf(snapped, "y"), spanOf(snapped, "x"), targets),
    ],
  };
};

// Snaps a single point, e.g. a line's endpoint, on both axes
export const snapPoint = (
  point: Point,
  targets: readonly Rect[],
  distance: number
): SnapResult => {
  const dx = snapValue(point.x, targets, "x", distance) ?? 0;
  const dy = snapValue(point.y, targets, "y", distance) ?? 0;
  const x = point.x + dx;
  const y = point.y + dy;
  return {
    dx,
    dy,
    guides: [
      ...guidesAt("x", [x], { from: y, to: y }, targets),
      ...guidesAt("y", [y], { from: x, to: x }, targets),
    ],
  };
};

interface AxisSnap {
  x: number | null;
  y: number | null;
}

// A ratio-keeping corner snaps on its closer axis only; the other follows
// along the diagonal through the fixed corner
const alongDiagonal = (
  snapped: Point,
  shifts: AxisSnap,
  fixed: Point,
  box: Rect
): { point: Point; shifts: AxisSnap } => {
  const ratio = box.height / box.width;
  const signX = Math.sign(snapped.x - fixed.x) || 1;
  const signY = Math.sign(snapped.y - fixed.y) || 1;
  if (
    shifts.x !== null &&
    (shifts.y === null || Math.abs(shifts.x) <= Math.abs(shifts.y))
  ) {
    const height = Math.abs(snapped.x - fixed.x) * ratio;
    return {
      point: { x: snapped.x, y: fixed.y + signY * height },
      shifts: { x: shifts.x, y: null },
    };
  }
  if (shifts.y !== null) {
    const width = Math.abs(snapped.y - fixed.y) / ratio;
    return {
      point: { x: fixed.x + signX * width, y: snapped.y },
      shifts: { x: null, y: shifts.y },
    };
  }
  return { point: snapped, shifts };
};

// Snaps the corner or edge a resize handle drags (Konva's anchor names,
// e.g. "top-left" or "middle-right"). `point` is where the handle would go
// and `box` the box before this move. A corner that keeps its ratio is
// projected onto the box's diagonal afterwards, so only the closer axis
// snaps and the other slides along the diagonal with it.
export const snapResize = ({
  anchor,
  box,
  distance,
  keepRatio,
  point,
  targets,
}: {
  anchor: string;
  box: Rect;
  distance: number;
  keepRatio: boolean;
  point: Point;
  targets: readonly Rect[];
}): { point: Point; guides: SnapGuide[] } => {
  const movesX = anchor.includes("left") || anchor.includes("right");
  const movesY = anchor.includes("top") || anchor.includes("bottom");
  const fixed = {
    x: anchor.includes("left") ? box.x + box.width : box.x,
    y: anchor.includes("top") ? box.y + box.height : box.y,
  };
  let shifts: AxisSnap = {
    x: movesX ? snapValue(point.x, targets, "x", distance) : null,
    y: movesY ? snapValue(point.y, targets, "y", distance) : null,
  };
  let next = { x: point.x + (shifts.x ?? 0), y: point.y + (shifts.y ?? 0) };
  if (movesX && movesY && keepRatio && box.width > 0 && box.height > 0) {
    ({ point: next, shifts } = alongDiagonal(next, shifts, fixed, box));
  }

  // The resized box's extent across each axis, for the guides
  const spanX = movesX
    ? { from: Math.min(next.x, fixed.x), to: Math.max(next.x, fixed.x) }
    : spanOf(box, "x");
  const spanY = movesY
    ? { from: Math.min(next.y, fixed.y), to: Math.max(next.y, fixed.y) }
    : spanOf(box, "y");
  return {
    guides: [
      ...(shifts.x === null ? [] : guidesAt("x", [next.x], spanY, targets)),
      ...(shifts.y === null ? [] : guidesAt("y", [next.y], spanX, targets)),
    ],
    point: next,
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
