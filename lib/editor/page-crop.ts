import type { Point, Rect, Size } from "@/lib/document/geometry";
import { MIN_CANVAS_SIZE } from "@/lib/document/schema";

// Cropping the page: a box over it marks the part to keep. The box lives
// in page coordinates and stays inside the page; nothing changes until it's
// applied (see cropDocument).

export const fullPage = (page: Size): Rect => ({
  height: page.height,
  width: page.width,
  x: 0,
  y: 0,
});

export const isFullPage = (box: Rect, page: Size): boolean =>
  box.x === 0 &&
  box.y === 0 &&
  box.width === page.width &&
  box.height === page.height;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

// One axis of the box in whole pixels, inside [0, length], at least the
// smallest page size
const wholeSpan = (start: number, size: number, length: number) => {
  const from = Math.round(start);
  const span = clamp(
    Math.round(start + size) - from,
    Math.min(MIN_CANVAS_SIZE, length),
    length
  );
  return { size: span, start: clamp(from, 0, length - span) };
};

// The box as the page it becomes: whole pixels, inside the page, at least
// the smallest page size
export const wholeBox = (box: Rect, page: Size): Rect => {
  const x = wholeSpan(box.x, box.width, page.width);
  const y = wholeSpan(box.y, box.height, page.height);
  return { height: y.size, width: x.size, x: x.start, y: y.start };
};

// Where the dragged box may go: anywhere it stays inside the page
export const keepBoxInPage = (box: Rect, page: Size): Point => ({
  x: clamp(box.x, 0, page.width - box.width),
  y: clamp(box.y, 0, page.height - box.height),
});

// A handle (Konva's anchor names, e.g. "top-left" or "middle-right") moved
// the box from `previous` to `next`: the sides it pulls stay inside the
// page and at least `min` from the opposite side, which stays put
export const limitCropBox = ({
  anchor,
  min,
  next,
  page,
  previous,
}: {
  anchor: string;
  min: number;
  next: Rect;
  page: Size;
  previous: Rect;
}): Rect => {
  let left = previous.x;
  let right = previous.x + previous.width;
  let top = previous.y;
  let bottom = previous.y + previous.height;
  if (anchor.includes("left")) {
    left = clamp(next.x, 0, right - min);
  }
  if (anchor.includes("right")) {
    right = clamp(next.x + next.width, left + min, page.width);
  }
  if (anchor.includes("top")) {
    top = clamp(next.y, 0, bottom - min);
  }
  if (anchor.includes("bottom")) {
    bottom = clamp(next.y + next.height, top + min, page.height);
  }
  return { height: bottom - top, width: right - left, x: left, y: top };
};
