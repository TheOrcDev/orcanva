import { formatHex, mixRgba, parseHex } from "@/lib/document/color";
import type { Rgba } from "@/lib/document/color";
import { gradientPoints } from "@/lib/document/geometry";
import type { Point, Rect, Size } from "@/lib/document/geometry";
import { MIN_CANVAS_SIZE } from "@/lib/document/schema";
import type { Background, GradientStop } from "@/lib/document/schema";

// Cropping the page: a box over it marks the part to keep. The box lives
// in page coordinates and stays inside the page; nothing changes until it's
// applied (see cropDocument).

// Shapes the box can keep while it's resized
export const PAGE_CROP_RATIOS = [
  { label: "Free", value: "free" },
  { label: "Original", value: "original" },
  { label: "1:1", value: "1:1" },
  { label: "4:5", value: "4:5" },
  { label: "16:9", value: "16:9" },
  { label: "9:16", value: "9:16" },
] as const;

export type PageCropRatio = (typeof PAGE_CROP_RATIOS)[number]["value"];

// Width over height, or null when the box is free
export const ratioValue = (ratio: PageCropRatio, page: Size): number | null => {
  if (ratio === "free") {
    return null;
  }
  if (ratio === "original") {
    return page.width / page.height;
  }
  const [width = 1, height = 1] = ratio.split(":").map(Number);
  return width / height;
};

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

// The biggest box of a ratio that fits the page, centred where the box was
export const fitRatio = (box: Rect, ratio: number, page: Size): Rect => {
  const width = Math.min(page.width, page.height * ratio);
  const height = width / ratio;
  const centred = {
    height,
    width,
    x: box.x + box.width / 2 - width / 2,
    y: box.y + box.height / 2 - height / 2,
  };
  return { ...centred, ...keepBoxInPage(centred, page) };
};

// Pulled corners keep the ratio: the box shrinks to it, at least `min` on
// both sides, and the corner opposite the handle stays put
const keepRatio = (
  box: Rect,
  anchor: string,
  ratio: number,
  min: number
): Rect => {
  const tall = box.width / box.height < ratio;
  const minWidth = Math.max(min, min * ratio);
  const width = Math.max(minWidth, tall ? box.width : box.height * ratio);
  const height = width / ratio;
  return {
    height,
    width,
    x: anchor.includes("left") ? box.x + box.width - width : box.x,
    y: anchor.includes("top") ? box.y + box.height - height : box.y,
  };
};

// A handle (Konva's anchor names, e.g. "top-left" or "middle-right") moved
// the box from `previous` to `next`: the sides it pulls stay inside the
// page and at least `min` from the opposite side, which stays put. With a
// ratio, only corners resize the box.
export const limitCropBox = ({
  anchor,
  min,
  next,
  page,
  previous,
  ratio,
}: {
  anchor: string;
  min: number;
  next: Rect;
  page: Size;
  previous: Rect;
  ratio: number | null;
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
  const limited = {
    height: bottom - top,
    width: right - left,
    x: left,
    y: top,
  };
  return ratio === null ? limited : keepRatio(limited, anchor, ratio, min);
};

type LinearBackground = Extract<Background, { type: "linear" }>;

const MAX_STOPS = 8;
// Stops this close to the new page's ends are replaced by its end colours
const AT_END = 1e-6;

// Where a point falls along a gradient line, 0 at its start and 1 at its end
const offsetOn = (line: { start: Point; end: Point }, point: Point) => {
  const dx = line.end.x - line.start.x;
  const dy = line.end.y - line.start.y;
  return (
    ((point.x - line.start.x) * dx + (point.y - line.start.y) * dy) /
    (dx * dx + dy * dy)
  );
};

// The colour a gradient shows at an offset; its end colours carry on past
// its ends, as a canvas draws them
const colorAt = (
  stops: readonly { offset: number; color: Rgba }[],
  offset: number
): Rgba => {
  const [first] = stops;
  if (!first || offset <= first.offset) {
    return first?.color ?? [0, 0, 0, 0];
  }
  for (let index = 1; index < stops.length; index += 1) {
    const before = stops[index - 1] ?? first;
    const after = stops[index] ?? first;
    if (offset <= after.offset) {
      const span = after.offset - before.offset;
      return span > 0
        ? mixRgba(before.color, after.color, (offset - before.offset) / span)
        : after.color;
    }
  }
  return stops.at(-1)?.color ?? first.color;
};

// A page gradient runs corner to corner of the page, so a cropped page would
// spread it anew. This keeps every colour on the same spot of the page,
// along the cropped page's own gradient line. Colours that aren't hex, or
// more stops than a gradient holds, leave it as it was.
export const cropGradient = (
  background: LinearBackground,
  page: Size,
  box: Rect
): LinearBackground => {
  const parsed = background.stops.map((stop) => ({
    color: parseHex(stop.color),
    offset: stop.offset,
  }));
  const stops = parsed
    .flatMap((stop) => (stop.color ? [{ ...stop, color: stop.color }] : []))
    .toSorted((a, b) => a.offset - b.offset);
  if (stops.length !== parsed.length) {
    return background;
  }
  const line = gradientPoints(background.angle, page);
  const cropped = gradientPoints(background.angle, box);
  // The cropped line's ends, as offsets on the page's line
  const from = offsetOn(line, {
    x: box.x + cropped.start.x,
    y: box.y + cropped.start.y,
  });
  const to = offsetOn(line, {
    x: box.x + cropped.end.x,
    y: box.y + cropped.end.y,
  });
  const between: GradientStop[] = stops.flatMap((stop) => {
    const offset = (stop.offset - from) / (to - from);
    return offset > AT_END && offset < 1 - AT_END
      ? [{ color: formatHex(stop.color), offset }]
      : [];
  });
  const next = [
    { color: formatHex(colorAt(stops, from)), offset: 0 },
    ...between,
    { color: formatHex(colorAt(stops, to)), offset: 1 },
  ];
  return next.length > MAX_STOPS ? background : { ...background, stops: next };
};
