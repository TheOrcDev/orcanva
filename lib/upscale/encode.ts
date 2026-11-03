// How an upscaled photo is stored. Opaque ones are JPEGs (Safari's canvas
// can't encode WebP, and a PNG of a 4K photo is far bigger); ones with
// transparency, like a cutout, stay PNG.
export const JPEG_QUALITY = 0.92;

export const hasTransparency = (rgba: Uint8ClampedArray): boolean => {
  for (let index = 3; index < rgba.length; index += 4) {
    if ((rgba[index] ?? 255) < 255) {
      return true;
    }
  }
  return false;
};

export const encodeOptions = (transparent: boolean): ImageEncodeOptions =>
  transparent
    ? { type: "image/png" }
    : { quality: JPEG_QUALITY, type: "image/jpeg" };

// Gives every fully transparent pixel the colour of the nearest visible one
// (in place). The model sees only colour, and the black hidden under a
// cutout's transparency would otherwise bleed into its edge as a dark
// fringe. Visible pixels, half-transparent ones included, keep theirs.
export const bleedEdges = (
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): void => {
  const count = width * height;
  const filled = new Uint8Array(count);
  // A breadth-first fill outwards from every visible pixel at once
  const queue = new Int32Array(count);
  let tail = 0;
  for (let pixel = 0; pixel < count; pixel += 1) {
    if ((rgba[pixel * 4 + 3] ?? 0) > 0) {
      filled[pixel] = 1;
      queue[tail] = pixel;
      tail += 1;
    }
  }
  for (let head = 0; head < tail; head += 1) {
    const pixel = queue[head] ?? 0;
    const x = pixel % width;
    const neighbours = [
      x > 0 ? pixel - 1 : -1,
      x < width - 1 ? pixel + 1 : -1,
      pixel - width,
      pixel + width,
    ];
    for (const next of neighbours) {
      if (next >= 0 && next < count && filled[next] === 0) {
        filled[next] = 1;
        rgba.copyWithin(next * 4, pixel * 4, pixel * 4 + 3);
        queue[tail] = next;
        tail += 1;
      }
    }
  }
};

// The alpha channel as a grey picture, so the same model can upscale it
export const alphaAsGrey = (
  rgba: Uint8ClampedArray
): Uint8ClampedArray<ArrayBuffer> => {
  const grey = new Uint8ClampedArray(rgba.length);
  for (let index = 0; index < rgba.length; index += 4) {
    const alpha = rgba[index + 3] ?? 255;
    grey[index] = alpha;
    grey[index + 1] = alpha;
    grey[index + 2] = alpha;
    grey[index + 3] = 255;
  }
  return grey;
};

// Puts an upscaled grey picture back as the alpha of the upscaled colour
export const restoreAlpha = (
  rgba: Uint8ClampedArray,
  grey: Uint8ClampedArray
): void => {
  for (let index = 0; index < rgba.length; index += 4) {
    const red = grey[index] ?? 0;
    const green = grey[index + 1] ?? 0;
    const blue = grey[index + 2] ?? 0;
    rgba[index + 3] = Math.round((red + green + blue) / 3);
  }
};
