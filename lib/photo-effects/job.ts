import type { EffectsLayout, EffectsPaint } from "@/lib/photo-effects/geometry";
import type { PhotoMask } from "@/lib/photo-effects/mask";

export interface EffectsJob {
  // Whose effects these are; its field is kept for the next recolouring.
  // Null for one-off drawings (previews), which keep nothing.
  owner: object | null;
  // Everything the field depends on: the same key reuses the owner's field
  fieldKey: string;
  layout: EffectsLayout;
  mask: PhotoMask;
  paint: EffectsPaint;
  // Caller-owned canvases the bitmaps land in (Konva and exports share them)
  halo: HTMLCanvasElement;
  shadow: HTMLCanvasElement;
}

// Which bitmaps were drawn. A blurred shadow is kept at a reduced size,
// since its blur hides the detail.
export interface EffectsOutput {
  halo: boolean;
  shadow: boolean;
}
