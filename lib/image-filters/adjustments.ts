import { imageAdjustmentsSchema } from "@/lib/document/schema";
import type { ImageAdjustments } from "@/lib/document/schema";

export type AdjustmentKey = keyof ImageAdjustments;

// Every slider tops out at 100; centred ones start at -100, others at 0
export const ADJUSTMENTS: Record<
  AdjustmentKey,
  { label: string; min: number }
> = {
  blur: { label: "Blur", min: 0 },
  brightness: { label: "Brightness", min: -100 },
  contrast: { label: "Contrast", min: -100 },
  fade: { label: "Fade", min: 0 },
  grain: { label: "Grain", min: 0 },
  highlights: { label: "Highlights", min: -100 },
  saturation: { label: "Saturation", min: -100 },
  shadows: { label: "Shadows", min: -100 },
  sharpen: { label: "Sharpen", min: 0 },
  tint: { label: "Tint", min: -100 },
  vignette: { label: "Vignette", min: 0 },
  warmth: { label: "Warmth", min: -100 },
};

export const ADJUSTMENT_MAX = 100;

// Panel order: light, then colour, then finishing touches
export const ADJUSTMENT_ORDER: readonly AdjustmentKey[] = [
  "brightness",
  "contrast",
  "highlights",
  "shadows",
  "saturation",
  "warmth",
  "tint",
  "fade",
  "vignette",
  "sharpen",
  "grain",
  "blur",
];

export const NEUTRAL_ADJUSTMENTS: ImageAdjustments =
  imageAdjustmentsSchema.parse({});

export const clampAdjustment = (key: AdjustmentKey, value: number): number =>
  Math.min(ADJUSTMENT_MAX, Math.max(ADJUSTMENTS[key].min, value));
