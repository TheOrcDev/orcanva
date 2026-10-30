import { MAX_CANVAS_SIZE, MIN_CANVAS_SIZE } from "@/lib/document/schema";

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Rect extends Point, Size {}

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
