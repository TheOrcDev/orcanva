import type { ImageAdjustments, ImageFilter } from "@/lib/document/schema";
import {
  ADJUSTMENT_ORDER,
  NEUTRAL_ADJUSTMENTS,
  clampAdjustment,
} from "@/lib/image-filters/adjustments";
import { findPreset } from "@/lib/image-filters/presets";
import type { FilterTone } from "@/lib/image-filters/presets";

export interface ResolvedFilter {
  adjust: ImageAdjustments;
  tone: FilterTone | null;
}

// What the image actually gets: the preset scaled by its intensity, with the
// manual sliders added on top. null when nothing would change, so untouched
// images never reach the GPU.
export const resolveFilter = (
  filter: ImageFilter | null
): ResolvedFilter | null => {
  if (!filter) {
    return null;
  }
  const preset = findPreset(filter.preset);
  const scale = preset ? filter.strength / 100 : 0;
  const adjust = { ...NEUTRAL_ADJUSTMENTS };
  let changed = false;
  for (const key of ADJUSTMENT_ORDER) {
    const value = clampAdjustment(
      key,
      (preset?.adjust[key] ?? 0) * scale + filter.adjust[key]
    );
    adjust[key] = value;
    changed ||= value !== 0;
  }
  const tone =
    preset?.tone && scale > 0
      ? { ...preset.tone, amount: preset.tone.amount * scale }
      : null;
  return changed || tone ? { adjust, tone } : null;
};

type Rgb = [number, number, number];

// Numbers the shader works with, all derived here so the tuning is testable
export interface FilterUniforms {
  // Per-channel white balance from warmth and tint
  gains: Rgb;
  // Midtone gamma: below 1 brightens, black and white stay put
  brightnessGamma: number;
  // Slope around mid grey
  contrast: number;
  // Gammas applied to the dark and bright ends of luminance
  shadowsGamma: number;
  highlightsGamma: number;
  // 0 = greyscale, 1 = unchanged, 2 = double
  saturation: number;
  toneShadows: Rgb;
  toneHighlights: Rgb;
  toneAmount: number;
  // Fade lifts the blacks and dims the whites: rgb * fadeScale + fadeLift
  fadeScale: number;
  fadeLift: number;
  vignette: number;
  sharpen: number;
  grain: number;
  // Gaussian sigma as a fraction of the image's longer side
  blur: number;
}

const WARMTH_GAIN = 0.18;
const TINT_GAIN = 0.12;
const BRIGHTNESS_RANGE = 1;
const CONTRAST_RANGE = 0.85;
const TONE_RANGE = 1.2;
const FADE_LIFT = 0.16;
const FADE_DIM = 0.18;
const VIGNETTE_DARKEN = 0.8;
const SHARPEN_AMOUNT = 1.5;
const GRAIN_AMOUNT = 0.18;
const MAX_BLUR_SIGMA = 0.02;
const TONE_STRENGTH = 0.5;

const HEX_COLOR = /^#[\da-f]{6}$/iu;
const NEUTRAL_TONE: Rgb = [0.5, 0.5, 0.5];

// Slider units (-100–100) to -1–1
const unit = (value: number) => value / 100;

export const hexToRgb = (hex: string): Rgb => {
  if (!HEX_COLOR.test(hex)) {
    return NEUTRAL_TONE;
  }
  const channel = (start: number) =>
    Number.parseInt(hex.slice(start, start + 2), 16) / 255;
  return [channel(1), channel(3), channel(5)];
};

export const toUniforms = ({
  adjust,
  tone,
}: ResolvedFilter): FilterUniforms => {
  const warmth = unit(adjust.warmth);
  const tint = unit(adjust.tint);
  const fade = unit(adjust.fade);

  return {
    blur: unit(adjust.blur) * MAX_BLUR_SIGMA,
    brightnessGamma: 2 ** (-unit(adjust.brightness) * BRIGHTNESS_RANGE),
    contrast: 2 ** (unit(adjust.contrast) * CONTRAST_RANGE),
    fadeLift: fade * FADE_LIFT,
    fadeScale: 1 - fade * FADE_DIM,
    gains: [
      1 + warmth * WARMTH_GAIN + tint * TINT_GAIN * 0.5,
      1 - tint * TINT_GAIN,
      1 - warmth * WARMTH_GAIN + tint * TINT_GAIN * 0.5,
    ],
    grain: unit(adjust.grain) * GRAIN_AMOUNT,
    highlightsGamma: 2 ** (unit(adjust.highlights) * TONE_RANGE),
    saturation: 1 + unit(adjust.saturation),
    shadowsGamma: 2 ** (-unit(adjust.shadows) * TONE_RANGE),
    sharpen: unit(adjust.sharpen) * SHARPEN_AMOUNT,
    toneAmount: tone ? unit(tone.amount) * TONE_STRENGTH : 0,
    toneHighlights: tone ? hexToRgb(tone.highlights) : NEUTRAL_TONE,
    toneShadows: tone ? hexToRgb(tone.shadows) : NEUTRAL_TONE,
    vignette: unit(adjust.vignette) * VIGNETTE_DARKEN,
  };
};
