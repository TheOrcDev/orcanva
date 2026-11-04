import { MAX_CANVAS_SIZE, MIN_CANVAS_SIZE } from "@/lib/document/schema";
import type { DesignElement } from "@/lib/document/schema";

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect extends Point, Size {}

const ALIGN_SHARE = { center: 0.5, left: 0, right: 1 } as const;

// What an element draws, in its own frame (before it turns about its
// top-left corner). A text's size comes from measuring it: its wrap width
// (or just its longest line, placed by its alignment) by its lines' height,
// or its arc's box, centred on its width; a highlight adds its padding.
// Without one, a text counts as a single line as wide as its box.
const localBox = (element: DesignElement, textSize?: Size): Rect => {
  if (element.type === "text") {
    const size = textSize ?? {
      height: element.fontSize * element.lineHeight,
      width: element.width,
    };
    const straight = element.curve === 0;
    const share = straight ? ALIGN_SHARE[element.align] : 0.5;
    // A highlight (straight text only) reaches past the lines all round
    const pad =
      straight && element.highlight
        ? element.highlight.paddingEm * element.fontSize
        : 0;
    return {
      height: size.height + pad * 2,
      width: size.width + pad * 2,
      x: (element.width - size.width) * share - pad,
      y: -pad,
    };
  }
  if (element.type === "line" || element.type === "arrow") {
    return { height: 0, width: 0, x: 0, y: 0 };
  }
  return { height: element.height, width: element.width, x: 0, y: 0 };
};

// The page-aligned box around an element as it's drawn: boxes turn about
// their top-left corner, and lines (which never turn) reach half their
// stroke past their points
export const rotatedBounds = (
  element: DesignElement,
  textSize?: Size
): Rect => {
  if (element.type === "line" || element.type === "arrow") {
    const [x1, y1, x2, y2] = element.points;
    const half = element.strokeWidth / 2;
    const left = element.x + Math.min(x1, x2) - half;
    const top = element.y + Math.min(y1, y2) - half;
    return {
      height: Math.abs(y2 - y1) + half * 2,
      width: Math.abs(x2 - x1) + half * 2,
      x: left,
      y: top,
    };
  }
  const box = localBox(element, textSize);
  const radians = (element.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const xs: number[] = [];
  const ys: number[] = [];
  for (const [cornerX, cornerY] of [
    [box.x, box.y],
    [box.x + box.width, box.y],
    [box.x, box.y + box.height],
    [box.x + box.width, box.y + box.height],
  ] as const) {
    xs.push(element.x + cornerX * cos - cornerY * sin);
    ys.push(element.y + cornerX * sin + cornerY * cos);
  }
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  return {
    height: Math.max(...ys) - top,
    width: Math.max(...xs) - left,
    x: left,
    y: top,
  };
};

// Safari refuses to allocate canvases above ~16.7 megapixels
export const MAX_EXPORT_PIXELS = 16_777_216;

export const clampCanvasSize = (value: number): number => {
  if (!Number.isFinite(value)) {
    return MIN_CANVAS_SIZE;
  }
  return Math.min(
    MAX_CANVAS_SIZE,
    Math.max(MIN_CANVAS_SIZE, Math.round(value))
  );
};

// Largest size with the source aspect ratio that fits inside the bounds
export const fitWithin = (source: Size, bounds: Size): Size => {
  const scale = Math.min(
    bounds.width / source.width,
    bounds.height / source.height
  );
  return { height: source.height * scale, width: source.width * scale };
};

// Smallest size with the source aspect ratio that covers the bounds
export const coverSize = (source: Size, bounds: Size): Size => {
  const scale = Math.max(
    bounds.width / source.width,
    bounds.height / source.height
  );
  return { height: source.height * scale, width: source.width * scale };
};

export const centerIn = (size: Size, bounds: Size): Point => ({
  x: (bounds.width - size.width) / 2,
  y: (bounds.height - size.height) / 2,
});

// Zoom that fits the page inside the viewport with padding on every side
export const fitZoom = (page: Size, viewport: Size, padding = 48): number => {
  const available = {
    height: Math.max(1, viewport.height - padding * 2),
    width: Math.max(1, viewport.width - padding * 2),
  };
  return Math.min(available.width / page.width, available.height / page.height);
};

export const canExportAt = (size: Size, multiplier: number): boolean =>
  size.width * size.height * multiplier * multiplier <= MAX_EXPORT_PIXELS;

// Start/end points of a CSS-style linear gradient angle across a box
export const gradientPoints = (
  angleDegrees: number,
  size: Size
): { start: Point; end: Point } => {
  const radians = ((angleDegrees - 90) * Math.PI) / 180;
  const dx = Math.cos(radians);
  const dy = Math.sin(radians);
  const halfLength =
    (Math.abs(size.width * dx) + Math.abs(size.height * dy)) / 2;
  const center = { x: size.width / 2, y: size.height / 2 };
  return {
    end: { x: center.x + dx * halfLength, y: center.y + dy * halfLength },
    start: { x: center.x - dx * halfLength, y: center.y - dy * halfLength },
  };
};

const DIACRITICS = /\p{M}/gu;
const NON_ALPHANUMERIC = /[^a-z0-9]+/gu;
const EDGE_DASHES = /^-+|-+$/gu;

export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .normalize("NFKD")
    .replaceAll(DIACRITICS, "")
    .replaceAll(NON_ALPHANUMERIC, "-")
    .replaceAll(EDGE_DASHES, "")
    .slice(0, 60) || "design";
