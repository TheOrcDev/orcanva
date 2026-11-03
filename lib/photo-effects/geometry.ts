import {
  MAX_PHOTO_EFFECT_OFFSET,
  MAX_PHOTO_EFFECT_SIZE,
} from "@/lib/document/schema";
import type { PhotoEffects } from "@/lib/document/schema";

const clampSize = (value: number) =>
  Math.min(MAX_PHOTO_EFFECT_SIZE, Math.max(0, value));

const clampOffset = (value: number) =>
  Math.min(MAX_PHOTO_EFFECT_OFFSET, Math.max(-MAX_PHOTO_EFFECT_OFFSET, value));

// The effects of a photo drawn `factor` times bigger, the way a corner
// resize, a page resize or Fill page scales it. A factor of 1 (a side-handle
// crop) keeps the very same values.
export const scalePhotoEffects = (
  { glow, outline, shadow }: PhotoEffects,
  factor: number
): PhotoEffects => {
  if (factor === 1 || !Number.isFinite(factor)) {
    return { glow, outline, shadow };
  }
  return {
    glow: glow && { ...glow, size: clampSize(glow.size * factor) },
    outline: outline && {
      ...outline,
      width: clampSize(outline.width * factor),
    },
    shadow: shadow && {
      ...shadow,
      blur: clampSize(shadow.blur * factor),
      offsetX: clampOffset(shadow.offsetX * factor),
      offsetY: clampOffset(shadow.offsetY * factor),
    },
  };
};
