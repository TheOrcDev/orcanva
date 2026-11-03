import type { Rgba } from "@/lib/document/color";
import type { Rect, Size } from "@/lib/document/geometry";
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

// Effect bitmaps hold twice the photo's page size, which covers retina
// screens and the 2× export, as filtered photos do
export const EFFECTS_SUPERSAMPLE = 2;
// A glow's or a shadow's Gaussian sigma per px of its size or blur. Canvas
// shadows (so Konva's, and text shadows) use blur / 2 too.
export const SIGMA_PER_PX = 0.5;
// How far out a Gaussian still shows, in sigmas
const BLUR_REACH = 3;
// Bitmap px kept clear around what's drawn, for its anti-aliased edge
const EDGE_MARGIN = 2;
// The padding grows in steps of this many bitmap px, so scrubbing a glow or
// a blur mostly keeps the same distance field
export const PAD_STEP = 16;

// How far (page px) each bitmap reaches beyond the box: the outline and
// glow in one, the shadow in the other, and null when it isn't drawn
export interface EffectsReach {
  halo: number | null;
  shadow: number | null;
}

export const effectsReach = ({
  glow,
  outline,
  shadow,
}: PhotoEffects): EffectsReach => {
  const outlineWidth = outline?.width ?? 0;
  const glowReach = glow ? glow.size * SIGMA_PER_PX * BLUR_REACH : 0;
  return {
    halo: outlineWidth > 0 || glowReach > 0 ? outlineWidth + glowReach : null,
    shadow: shadow
      ? outlineWidth + shadow.blur * SIGMA_PER_PX * BLUR_REACH
      : null,
  };
};

// Where everything is computed: the photo's box at `scale` bitmap px per
// page px, with `pad` bitmap px all round. Each output is a region of it.
export interface EffectsLayout {
  scale: number;
  pad: number;
  size: Size;
  halo: Rect | null;
  shadow: Rect | null;
}

// Null when no effect draws anything. The field never exceeds `maxSide`
// (the GPU's limit, or the filters' cap): bigger photos get fewer bitmap px
// per page px.
export const effectsLayout = (
  box: Size,
  effects: PhotoEffects,
  maxSide: number
): EffectsLayout | null => {
  const reach = effectsReach(effects);
  if (reach.halo === null && reach.shadow === null) {
    return null;
  }
  const furthest = Math.max(reach.halo ?? 0, reach.shadow ?? 0);
  // Room for rounding up: the box, the margin and the padding's last step
  const slack = 2 * (PAD_STEP + EDGE_MARGIN + 1);
  const scale = Math.min(
    EFFECTS_SUPERSAMPLE,
    (maxSide - slack) / (Math.max(box.width, box.height) + 2 * furthest)
  );
  const inner = {
    height: Math.max(1, Math.ceil(box.height * scale)),
    width: Math.max(1, Math.ceil(box.width * scale)),
  };
  const padFor = (distance: number) =>
    Math.ceil(distance * scale) + EDGE_MARGIN;
  const pad = Math.ceil(padFor(furthest) / PAD_STEP) * PAD_STEP;
  const region = (distance: number | null): Rect | null => {
    if (distance === null) {
      return null;
    }
    const own = Math.min(pad, padFor(distance));
    return {
      height: inner.height + 2 * own,
      width: inner.width + 2 * own,
      x: pad - own,
      y: pad - own,
    };
  };
  return {
    halo: region(reach.halo),
    pad,
    scale,
    shadow: region(reach.shadow),
    size: { height: inner.height + 2 * pad, width: inner.width + 2 * pad },
  };
};

// Where a region of the field lands around the box, in page px from its
// top-left corner
export const regionOnPage = (layout: EffectsLayout, region: Rect): Rect => ({
  height: region.height / layout.scale,
  width: region.width / layout.scale,
  x: (region.x - layout.pad) / layout.scale,
  y: (region.y - layout.pad) / layout.scale,
});

// Steps of a jump flood that finds every seed within `distance` px: steps
// s, s/2, …, 1 reach 2s − 1 px, and a last step of 1 mends most of the
// flood's misses
export const floodSteps = (distance: number): number[] => {
  const reach = Math.max(1, Math.ceil(distance));
  let step = 1;
  while (2 * step - 1 < reach) {
    step *= 2;
  }
  const steps: number[] = [];
  for (let current = step; current >= 1; current /= 2) {
    steps.push(current);
  }
  steps.push(1);
  return steps;
};

// A colour in 0–1 with its alpha multiplied in, as the shaders blend it
export type Premultiplied = [number, number, number, number];

const premultiply = ([red, green, blue, alpha]: Rgba): Premultiplied => {
  const opacity = alpha / 255;
  return [
    (red / 255) * opacity,
    (green / 255) * opacity,
    (blue / 255) * opacity,
    opacity,
  ];
};

// What the colouring passes draw with, in bitmap px of the layout
export interface EffectsPaint {
  outline: { color: Premultiplied; width: number } | null;
}

export const effectsPaint = (
  { outline }: PhotoEffects,
  scale: number,
  rgba: (color: string) => Rgba
): EffectsPaint => ({
  outline:
    outline && outline.width > 0
      ? {
          color: premultiply(rgba(outline.color)),
          width: outline.width * scale,
        }
      : null,
});

// Effects with sizes as fractions of the photo's shorter side, so a default
// or a preset looks alike on any photo
export type RelativeEffects = PhotoEffects;

// What each switch turns on
export const DEFAULT_EFFECTS = {
  glow: { color: "#ffffff", size: 0.08 },
  outline: { color: "#ffffff", width: 0.03 },
  shadow: { blur: 0.05, color: "#00000080", offsetX: 0.015, offsetY: 0.03 },
} as const satisfies RelativeEffects;

// A fraction of the side in whole px, within the schema's limits; a size
// that's on stays at least 1 px
const offsetPixels = (fraction: number, side: number) =>
  clampOffset(Math.round(fraction * side));

const sizePixels = (fraction: number, side: number, least = 1) =>
  fraction > 0 ? clampSize(Math.max(least, Math.round(fraction * side))) : 0;

export const effectsAtSize = (
  { glow, outline, shadow }: RelativeEffects,
  box: Size
): PhotoEffects => {
  const side = Math.min(box.width, box.height);
  return {
    glow: glow && { ...glow, size: sizePixels(glow.size, side) },
    outline: outline && {
      ...outline,
      width: sizePixels(outline.width, side),
    },
    shadow: shadow && {
      ...shadow,
      blur: sizePixels(shadow.blur, side, 0),
      offsetX: offsetPixels(shadow.offsetX, side),
      offsetY: offsetPixels(shadow.offsetY, side),
    },
  };
};
