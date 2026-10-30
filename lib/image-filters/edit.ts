import type { ImageFilter } from "@/lib/document/schema";
import {
  ADJUSTMENT_ORDER,
  NEUTRAL_ADJUSTMENTS,
} from "@/lib/image-filters/adjustments";
import type { AdjustmentKey } from "@/lib/image-filters/adjustments";
import { DEFAULT_PRESET_STRENGTH } from "@/lib/image-filters/presets";

const EMPTY_FILTER: ImageFilter = {
  adjust: NEUTRAL_ADJUSTMENTS,
  preset: null,
  strength: DEFAULT_PRESET_STRENGTH,
};

// No preset and every slider at zero is the same as no filter, and stored
// as null so the image is plainly "untouched" again
const normalize = (filter: ImageFilter): ImageFilter | null =>
  filter.preset === null &&
  ADJUSTMENT_ORDER.every((key) => filter.adjust[key] === 0)
    ? null
    : filter;

export const withAdjustment = (
  filter: ImageFilter | null,
  key: AdjustmentKey,
  value: number
): ImageFilter | null => {
  const current = filter ?? EMPTY_FILTER;
  return normalize({
    ...current,
    adjust: { ...current.adjust, [key]: value },
  });
};

// Picking a look starts it at full intensity; "Original" (null) drops it but
// keeps the manual sliders
export const withPreset = (
  filter: ImageFilter | null,
  preset: string | null
): ImageFilter | null =>
  normalize({
    ...(filter ?? EMPTY_FILTER),
    preset,
    strength: DEFAULT_PRESET_STRENGTH,
  });

export const withStrength = (
  filter: ImageFilter | null,
  strength: number
): ImageFilter | null => (filter ? normalize({ ...filter, strength }) : null);

export const withoutAdjustments = (
  filter: ImageFilter | null
): ImageFilter | null =>
  filter ? normalize({ ...filter, adjust: NEUTRAL_ADJUSTMENTS }) : null;

export const hasAdjustments = (filter: ImageFilter | null): boolean =>
  filter !== null && ADJUSTMENT_ORDER.some((key) => filter.adjust[key] !== 0);
