import { normalizeHex } from "@/lib/document/color";
import type { Size } from "@/lib/document/geometry";
import type { PhotoEffects } from "@/lib/document/schema";
import { effectsAtSize } from "@/lib/photo-effects/geometry";
import type { RelativeEffects } from "@/lib/photo-effects/geometry";

export interface PhotoEffectPreset {
  id: string;
  name: string;
  // Sizes as fractions of the photo's shorter side
  effects: RelativeEffects;
}

const NONE: RelativeEffects = { glow: null, outline: null, shadow: null };

// One-tap looks for photos, the classic thumbnail cut-out ones first
export const PHOTO_EFFECT_PRESETS: readonly PhotoEffectPreset[] = [
  { effects: NONE, id: "none", name: "None" },
  {
    effects: {
      ...NONE,
      outline: { color: "#ffffff", width: 0.035 },
      shadow: { blur: 0.04, color: "#00000066", offsetX: 0, offsetY: 0.02 },
    },
    id: "sticker",
    name: "Sticker",
  },
  {
    effects: { ...NONE, outline: { color: "#ffffff", width: 0.02 } },
    id: "outline",
    name: "Outline",
  },
  {
    effects: { ...NONE, glow: { color: "#ffffff", size: 0.1 } },
    id: "glow",
    name: "Glow",
  },
  {
    effects: {
      ...NONE,
      glow: { color: "#ff2e93", size: 0.12 },
      outline: { color: "#ff2e93", width: 0.012 },
    },
    id: "neon",
    name: "Neon",
  },
  {
    effects: {
      ...NONE,
      shadow: { blur: 0.06, color: "#00000080", offsetX: 0.02, offsetY: 0.03 },
    },
    id: "shadow",
    name: "Shadow",
  },
];

// A preset's effects in px for a photo of this size
export const presetEffects = (
  preset: PhotoEffectPreset,
  box: Size
): PhotoEffects => effectsAtSize(preset.effects, box);

// Sizes match within a px, or a few percent once the photo has been
// scaled (presets round to whole px, scaling doesn't)
const near = (value: number, target: number) =>
  Math.abs(value - target) <= Math.max(1, Math.abs(target) * 0.05);

const sameColor = (color: string, target: string) =>
  (normalizeHex(color) ?? color) === (normalizeHex(target) ?? target);

const sameEffects = (effects: PhotoEffects, target: PhotoEffects): boolean => {
  const { glow, outline, shadow } = effects;
  const matches = [
    glow === null || target.glow === null
      ? glow === target.glow
      : sameColor(glow.color, target.glow.color) &&
        near(glow.size, target.glow.size),
    outline === null || target.outline === null
      ? outline === target.outline
      : sameColor(outline.color, target.outline.color) &&
        near(outline.width, target.outline.width),
    shadow === null || target.shadow === null
      ? shadow === target.shadow
      : sameColor(shadow.color, target.shadow.color) &&
        near(shadow.blur, target.shadow.blur) &&
        near(shadow.offsetX, target.shadow.offsetX) &&
        near(shadow.offsetY, target.shadow.offsetY),
  ];
  return matches.every(Boolean);
};

// The preset a photo's effects still look like, if any: the tile shown as
// chosen. Changing a colour or a size leaves every tile unchosen.
export const matchingPreset = (
  effects: PhotoEffects,
  box: Size
): PhotoEffectPreset | undefined =>
  PHOTO_EFFECT_PRESETS.find((preset) =>
    sameEffects(effects, presetEffects(preset, box))
  );
