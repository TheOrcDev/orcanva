import type { ImageAdjustments } from "@/lib/document/schema";

// Split toning: shadows and highlights pushed towards two colours
export interface FilterTone {
  shadows: string;
  highlights: string;
  // 0–100, scaled by the preset's intensity like the adjustments
  amount: number;
}

// A look is just preset slider values, so the same renderer draws it and
// the intensity slider scales it
export interface FilterPreset {
  id: string;
  name: string;
  adjust: Partial<ImageAdjustments>;
  tone?: FilterTone;
}

export const DEFAULT_PRESET_STRENGTH = 100;

export const FILTER_PRESETS: readonly FilterPreset[] = [
  {
    adjust: {
      contrast: 25,
      saturation: 20,
      shadows: -10,
      vignette: 15,
      warmth: 15,
    },
    id: "forge",
    name: "Forge",
  },
  {
    adjust: {
      brightness: 8,
      fade: 10,
      saturation: 10,
      shadows: 20,
      warmth: 35,
    },
    id: "ember",
    name: "Ember",
    tone: { amount: 25, highlights: "#ffd9a0", shadows: "#6b3a1a" },
  },
  {
    adjust: { contrast: 10, saturation: -20, tint: -15, vignette: 20 },
    id: "swamp",
    name: "Swamp",
    tone: { amount: 40, highlights: "#d8d0a0", shadows: "#2f6b5e" },
  },
  {
    adjust: {
      brightness: 10,
      contrast: -25,
      fade: 45,
      saturation: -25,
      warmth: -10,
    },
    id: "mist",
    name: "Mist",
  },
  {
    adjust: {
      brightness: 12,
      contrast: 8,
      highlights: 15,
      saturation: -5,
      warmth: -30,
    },
    id: "frost",
    name: "Frost",
  },
  {
    adjust: { brightness: 5, contrast: -10, fade: 20, saturation: -100 },
    id: "bone",
    name: "Bone",
  },
  {
    adjust: {
      contrast: 45,
      highlights: 10,
      saturation: -100,
      shadows: -15,
      sharpen: 15,
      vignette: 20,
    },
    id: "ash",
    name: "Ash",
  },
  {
    adjust: { contrast: -5, fade: 35, grain: 30, saturation: -15, warmth: 25 },
    id: "rust",
    name: "Rust",
    tone: { amount: 30, highlights: "#f0d090", shadows: "#4a2a10" },
  },
  {
    adjust: { contrast: 10, saturation: -5, vignette: 30 },
    id: "dusk",
    name: "Dusk",
    tone: { amount: 45, highlights: "#ff9f80", shadows: "#3a1f5c" },
  },
  {
    adjust: {
      contrast: 40,
      grain: 15,
      saturation: -35,
      shadows: -20,
      sharpen: 40,
      vignette: 35,
    },
    id: "grit",
    name: "Grit",
  },
  {
    adjust: {
      contrast: 20,
      highlights: -10,
      saturation: 40,
      shadows: 10,
      sharpen: 20,
    },
    id: "vivid",
    name: "Vivid",
  },
];

export const findPreset = (id: string | null): FilterPreset | undefined =>
  id === null ? undefined : FILTER_PRESETS.find((preset) => preset.id === id);
