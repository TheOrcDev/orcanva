import type { Rect, Size } from "@/lib/document/geometry";
import type { ImageCrop } from "@/lib/document/schema";

export const FULL_CROP: ImageCrop = { height: 1, width: 1, x: 0, y: 0 };

// The smallest part of a photo a crop may keep, as a fraction of it
export const MIN_CROP_FRACTION = 0.01;

export const cropOrFull = (crop: ImageCrop | null): ImageCrop =>
  crop ?? FULL_CROP;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

// Keeps a crop inside the photo and at least the minimum size
export const clampCrop = (crop: ImageCrop): ImageCrop => {
  const width = clamp(crop.width, MIN_CROP_FRACTION, 1);
  const height = clamp(crop.height, MIN_CROP_FRACTION, 1);
  return {
    height,
    width,
    x: clamp(crop.x, 0, 1 - width),
    y: clamp(crop.y, 0, 1 - height),
  };
};

// Konva's crop: the same part in pixels of whatever is drawn (the photo, or
// a filtered copy at another resolution)
export const cropToPixels = (crop: ImageCrop | null, source: Size): Rect => {
  const { height, width, x, y } = cropOrFull(crop);
  return {
    height: height * source.height,
    width: width * source.width,
    x: x * source.width,
    y: y * source.height,
  };
};

// How big the whole photo is on the page when `box` shows `crop` of it
export const fullPhotoSize = (box: Size, crop: ImageCrop | null): Size => {
  const { height, width } = cropOrFull(crop);
  return { height: box.height / height, width: box.width / width };
};

// The centred part of a photo that covers a box of another shape, the way
// a frame fills with a photo
export const coverCrop = (photo: Size, box: Size): ImageCrop => {
  const photoRatio = photo.width / photo.height;
  const boxRatio = box.width / box.height;
  if (photoRatio > boxRatio) {
    const width = boxRatio / photoRatio;
    return { height: 1, width, x: (1 - width) / 2, y: 0 };
  }
  const height = photoRatio / boxRatio;
  return { height, width: 1, x: 0, y: (1 - height) / 2 };
};

// Mirrors a crop for a flipped photo, so what the person sees on the left is
// still on the left
export const mirrorCrop = (
  crop: ImageCrop,
  flipX: boolean,
  flipY: boolean
): ImageCrop => ({
  ...crop,
  x: flipX ? 1 - crop.x - crop.width : crop.x,
  y: flipY ? 1 - crop.y - crop.height : crop.y,
});

// Where the whole photo sits on the page for an unrotated element showing
// `crop` of it in `box`
export const photoRect = (box: Rect, crop: ImageCrop | null): Rect => {
  const full = fullPhotoSize(box, crop);
  const { x, y } = cropOrFull(crop);
  return {
    height: full.height,
    width: full.width,
    x: box.x - x * full.width,
    y: box.y - y * full.height,
  };
};

// The crop that shows `frame` (a box on the page) of a photo placed at
// `photo`, both unrotated
export const cropBetween = (frame: Rect, photo: Rect): ImageCrop =>
  clampCrop({
    height: frame.height / photo.height,
    width: frame.width / photo.width,
    x: (frame.x - photo.x) / photo.width,
    y: (frame.y - photo.y) / photo.height,
  });

// Keeps a crop frame inside the photo: shrinks it if it's bigger, then
// moves it in
export const containRect = (inner: Rect, outer: Rect): Rect => {
  const width = Math.min(inner.width, outer.width);
  const height = Math.min(inner.height, outer.height);
  return {
    height,
    width,
    x: Math.min(Math.max(inner.x, outer.x), outer.x + outer.width - width),
    y: Math.min(Math.max(inner.y, outer.y), outer.y + outer.height - height),
  };
};

// Keeps a photo covering its frame: scales it up (keeping its ratio) if
// it's too small, then moves it so no gap shows
export const coverRect = (photo: Rect, frame: Rect): Rect => {
  const scale = Math.max(
    1,
    frame.width / photo.width,
    frame.height / photo.height
  );
  const width = photo.width * scale;
  const height = photo.height * scale;
  return {
    height,
    width,
    x: Math.min(Math.max(photo.x, frame.x + frame.width - width), frame.x),
    y: Math.min(Math.max(photo.y, frame.y + frame.height - height), frame.y),
  };
};

// Shows the whole photo when a crop is (practically) all of it
export const isFullCrop = (crop: ImageCrop): boolean =>
  crop.x < 1e-4 &&
  crop.y < 1e-4 &&
  crop.width > 1 - 1e-4 &&
  crop.height > 1 - 1e-4;

// How far a crop is zoomed in: 1 when it reaches the photo's edges on one
// axis, 2 when it shows half as much
export const cropZoom = (crop: ImageCrop | null): number => {
  const { height, width } = cropOrFull(crop);
  return 1 / Math.max(width, height);
};

// The same crop zoomed to another level around its centre, keeping its shape
export const zoomCrop = (crop: ImageCrop | null, zoom: number): ImageCrop => {
  const current = cropOrFull(crop);
  const factor = cropZoom(current) / Math.max(1, zoom);
  const width = current.width * factor;
  const height = current.height * factor;
  return clampCrop({
    height,
    width,
    x: current.x + (current.width - width) / 2,
    y: current.y + (current.height - height) / 2,
  });
};
