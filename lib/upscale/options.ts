import { fullPhotoSize } from "@/lib/document/crop";
import type { Size } from "@/lib/document/geometry";
import type { ImageCrop } from "@/lib/document/schema";
import { MAX_IMAGE_SIDE } from "@/lib/upload/prepare-image";

export type UpscaleVariant = "upscaled-2x" | "upscaled-4x";

export interface UpscaleOption {
  variant: UpscaleVariant;
  // What the photo is scaled by: 2 or 4, or less where a limit caps it
  factor: number;
  width: number;
  height: number;
}

export interface UpscaleLimits {
  maxSide: number;
  maxPixels: number;
}

// Uploads keep to 4096px on the long side (prepareImage), and a 4K frame's
// worth of pixels is more than any page shows; a transparent PNG that big
// still fits the 25 MB upload limit
export const UPSCALE_LIMITS: UpscaleLimits = {
  maxPixels: 3840 * 2160,
  maxSide: MAX_IMAGE_SIDE,
};

// Less than this isn't worth a model run
const MIN_FACTOR = 1.25;

const FACTORS: readonly [UpscaleVariant, number][] = [
  ["upscaled-2x", 2],
  ["upscaled-4x", 4],
];

// The upscales a photo of `size` can have: 2× and 4×, each capped to the
// limits. A choice capped to the same size as a smaller one is left out, and
// so is one that would barely grow it.
export const upscaleOptions = (
  { height, width }: Size,
  { maxPixels, maxSide }: UpscaleLimits = UPSCALE_LIMITS
): UpscaleOption[] => {
  const room = Math.min(
    maxSide / Math.max(width, height),
    Math.sqrt(maxPixels / (width * height))
  );
  const options: UpscaleOption[] = [];
  for (const [variant, nominal] of FACTORS) {
    const factor = Math.min(nominal, room);
    // Floored, so rounding never passes a limit
    const size = {
      height: Math.max(1, Math.floor(height * factor + 1e-6)),
      width: Math.max(1, Math.floor(width * factor + 1e-6)),
    };
    const repeat = options.some((option) => option.width === size.width);
    if (factor >= MIN_FACTOR && !repeat) {
      options.push({ ...size, factor, variant });
    }
  }
  return options;
};

// "2×", or "3.2×" for a capped one
export const factorLabel = (factor: number): string =>
  `${Number(factor.toFixed(1))}×`;

// A photo stretched a few percent past its pixels still looks sharp
const SOFT_BELOW = 0.95;

// Photo pixels per page pixel where a box shows `crop` of a photo of `size`
export const pixelDensity = (
  photo: Size,
  box: Size,
  crop: ImageCrop | null
): number => {
  const full = fullPhotoSize(box, crop);
  return Math.min(photo.width / full.width, photo.height / full.height);
};

// The photo has fewer pixels than its size on the page needs, so it looks
// soft, in the editor and in a 1× download
export const looksSoft = (
  photo: Size,
  box: Size,
  crop: ImageCrop | null
): boolean => pixelDensity(photo, box, crop) < SOFT_BELOW;
