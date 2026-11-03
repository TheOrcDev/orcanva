import type { Size } from "@/lib/document/geometry";

// The magic eraser's pixel work, around the model: what part of the photo
// it sees, which pixels it fills, and putting them back.

// A rectangle of the photo, in its pixels
export interface PixelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// What the brush painted: a byte per pixel, anything above 0 to be filled
export interface Mask {
  data: Uint8Array;
  width: number;
  height: number;
}

// LaMa works at 512px, so the context is at least that much
export const MIN_CONTEXT = 512;

// The context is this many times the painted area's longer side, so the
// model has surroundings to continue
const CONTEXT_SCALE = 2;

// The box around every painted pixel, or null when nothing is painted
export const maskBounds = ({ data, height, width }: Mask): PixelRect | null => {
  let left = width;
  let right = -1;
  let top = height;
  let bottom = -1;
  for (let y = 0; y < height; y += 1) {
    const row = y * width;
    for (let x = 0; x < width; x += 1) {
      if ((data[row + x] ?? 0) > 0) {
        left = Math.min(left, x);
        right = Math.max(right, x);
        top = Math.min(top, y);
        bottom = Math.max(bottom, y);
      }
    }
  }
  return right < 0
    ? null
    : { height: bottom - top + 1, width: right - left + 1, x: left, y: top };
};

// Where a span of `length` px centred on `centre` fits within `size`
const fitSpan = (centre: number, length: number, size: number) => {
  const span = Math.min(length, size);
  const start = Math.round(centre - span / 2);
  return { length: span, start: Math.min(Math.max(0, start), size - span) };
};

// The part of the photo the model sees: a square around the painted area,
// twice its longer side and at least 512px, moved inside the photo and cut
// to it where the photo is smaller
export const contextRect = (
  bounds: PixelRect,
  photo: Size,
  minSide = MIN_CONTEXT
): PixelRect => {
  const side = Math.max(
    minSide,
    Math.ceil(Math.max(bounds.width, bounds.height) * CONTEXT_SCALE)
  );
  const across = fitSpan(bounds.x + bounds.width / 2, side, photo.width);
  const down = fitSpan(bounds.y + bounds.height / 2, side, photo.height);
  return {
    height: down.length,
    width: across.length,
    x: across.start,
    y: down.start,
  };
};

// The same part of a mask
export const cropMask = (mask: Mask, rect: PixelRect): Mask => {
  const data = new Uint8Array(rect.width * rect.height);
  for (let row = 0; row < rect.height; row += 1) {
    const from = (rect.y + row) * mask.width + rect.x;
    data.set(mask.data.subarray(from, from + rect.width), row * rect.width);
  }
  return { data, height: rect.height, width: rect.width };
};

// The same part of an RGBA picture
export const cropPixels = (
  photo: { data: Uint8ClampedArray; width: number },
  rect: PixelRect
): Uint8ClampedArray<ArrayBuffer> => {
  const pixels = new Uint8ClampedArray(rect.width * rect.height * 4);
  for (let row = 0; row < rect.height; row += 1) {
    const from = ((rect.y + row) * photo.width + rect.x) * 4;
    pixels.set(
      photo.data.subarray(from, from + rect.width * 4),
      row * rect.width * 4
    );
  }
  return pixels;
};

// How far the hole grows past the brush: about two pixels at the 512px the
// model works at, so an object's soft edge is filled too rather than left as
// a ghost
export const holeRadius = (rect: PixelRect): number =>
  Math.max(1, Math.round(Math.max(rect.width, rect.height) / 256));

// Whether any of `values` from `start` to `end` (inclusive) is painted, by
// prefix counts
const anyBetween = (counts: Int32Array, start: number, end: number) =>
  (counts[end + 1] ?? 0) - (counts[start] ?? 0) > 0;

// The painted pixels grown by `radius` in every direction (a square), and
// made solid: every pixel is 255 or 0. Rows, then columns.
export const dilate = (mask: Mask, radius: number): Mask => {
  const { height, width } = mask;
  const rows = new Uint8Array(width * height);
  const counts = new Int32Array(Math.max(width, height) + 1);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      counts[x + 1] =
        (counts[x] ?? 0) + ((mask.data[y * width + x] ?? 0) > 0 ? 1 : 0);
    }
    for (let x = 0; x < width; x += 1) {
      const painted = anyBetween(
        counts,
        Math.max(0, x - radius),
        Math.min(width - 1, x + radius)
      );
      rows[y * width + x] = painted ? 255 : 0;
    }
  }
  const data = new Uint8Array(width * height);
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      counts[y + 1] =
        (counts[y] ?? 0) + ((rows[y * width + x] ?? 0) > 0 ? 1 : 0);
    }
    for (let y = 0; y < height; y += 1) {
      const painted = anyBetween(
        counts,
        Math.max(0, y - radius),
        Math.min(height - 1, y + radius)
      );
      data[y * width + x] = painted ? 255 : 0;
    }
  }
  return { data, height, width };
};

// Puts the model's fill for `rect` into the photo (in place), only where
// `hole` (the size of `rect`) is painted. Colour only: the photo keeps its
// own alpha, so a cutout stays cut out.
export const pasteBack = (
  photo: { data: Uint8ClampedArray; width: number },
  filled: Uint8ClampedArray,
  hole: Mask,
  rect: PixelRect
): void => {
  for (let row = 0; row < rect.height; row += 1) {
    for (let column = 0; column < rect.width; column += 1) {
      const index = row * rect.width + column;
      if ((hole.data[index] ?? 0) > 0) {
        const to = ((rect.y + row) * photo.width + rect.x + column) * 4;
        photo.data.set(filled.subarray(index * 4, index * 4 + 3), to);
      }
    }
  }
};
