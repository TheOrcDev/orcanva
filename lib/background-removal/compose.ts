// The model's confidence never quite reaches 0 or 1, so a "solid" subject
// would come out at α≈254 (faintly see-through when layered). Snap
// near-certain values; soft edges in between stay untouched.
const SNAP_MARGIN = 6;

export const snapAlpha = (value: number): number => {
  if (value >= 255 - SNAP_MARGIN) {
    return 255;
  }
  if (value <= SNAP_MARGIN) {
    return 0;
  }
  return value;
};

// Folds a cutout mask into an RGBA image: the new alpha is the lower of the
// existing alpha and the (snapped) mask, so transparent pixels stay so.
export const applyMask = (
  rgba: Uint8Array,
  mask: ArrayLike<number>
): Uint8Array => {
  const pixels = rgba.length / 4;
  if (!Number.isInteger(pixels) || mask.length !== pixels) {
    throw new Error(
      `Mask has ${mask.length} values for an image of ${pixels} pixels`
    );
  }
  const output = new Uint8Array(rgba);
  for (let pixel = 0; pixel < pixels; pixel += 1) {
    const alphaIndex = pixel * 4 + 3;
    output[alphaIndex] = Math.min(
      output[alphaIndex] ?? 0,
      snapAlpha(mask[pixel] ?? 0)
    );
  }
  return output;
};

// The model's input is plain RGB; this drops the alpha channel
export const toRgb = (rgba: Uint8Array): Uint8ClampedArray => {
  const pixels = rgba.length / 4;
  const rgb = new Uint8ClampedArray(pixels * 3);
  for (let pixel = 0; pixel < pixels; pixel += 1) {
    rgb[pixel * 3] = rgba[pixel * 4] ?? 0;
    rgb[pixel * 3 + 1] = rgba[pixel * 4 + 1] ?? 0;
    rgb[pixel * 3 + 2] = rgba[pixel * 4 + 2] ?? 0;
  }
  return rgb;
};
