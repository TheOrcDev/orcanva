import { fitWithin } from "@/lib/document/geometry";
import type { Rect, Size } from "@/lib/document/geometry";
import { maxFilterSide } from "@/lib/image-filters/renderer";
import { effectRgba } from "@/lib/photo-effects/color";
import {
  effectsAtSize,
  effectsLayout,
  effectsPaint,
  regionOnPage,
} from "@/lib/photo-effects/geometry";
import type { RelativeEffects } from "@/lib/photo-effects/geometry";
import { drawPhoto } from "@/lib/photo-effects/mask";
import type { PhotoMask } from "@/lib/photo-effects/mask";
import { renderPhotoEffects } from "@/lib/photo-effects/renderer";

// Tiles are about 72 CSS px wide; twice that stays sharp on retina
export const EFFECT_PREVIEW_SIZE = 144;
// A mid grey, so a white outline and a dark shadow both show on it
const BACKDROP = "#a1a1aa";
// The photo's share of the tile, leaving room for what's drawn around it
const PHOTO_SHARE = 0.6;

// The photo as it looks on the page, at any size
export type PreviewPhoto = Omit<PhotoMask, "box"> & { aspect: Size };

// Scratch canvases shared by every tile: each is drawn into its tile
// straight away
let haloCanvas: HTMLCanvasElement | null = null;
let shadowCanvas: HTMLCanvasElement | null = null;

const place = (
  context: CanvasRenderingContext2D,
  canvas: HTMLCanvasElement,
  rect: Rect,
  dx = 0,
  dy = 0
) => {
  if (canvas.width > 0 && canvas.height > 0) {
    context.drawImage(
      canvas,
      rect.x + dx,
      rect.y + dy,
      rect.width,
      rect.height
    );
  }
};

// The photo with a preset's effects, sized for the tile as they would be
// for the photo on the page. Without WebGL2 it shows the photo alone.
export const drawEffectsPreview = (
  target: HTMLCanvasElement,
  photo: PreviewPhoto,
  effects: RelativeEffects
) => {
  const context = target.getContext("2d");
  if (!context) {
    return;
  }
  const room = Math.min(target.width, target.height) * PHOTO_SHARE;
  const box = fitWithin(photo.aspect, { height: room, width: room });
  const mask: PhotoMask = { ...photo, box };
  const sized = effectsAtSize(effects, box);
  context.fillStyle = BACKDROP;
  context.fillRect(0, 0, target.width, target.height);
  context.save();
  context.translate(
    (target.width - box.width) / 2,
    (target.height - box.height) / 2
  );
  const layout = effectsLayout(box, sized, maxFilterSide());
  if (layout) {
    haloCanvas ??= document.createElement("canvas");
    shadowCanvas ??= document.createElement("canvas");
    const output = renderPhotoEffects({
      fieldKey: "",
      halo: haloCanvas,
      layout,
      mask,
      owner: null,
      paint: effectsPaint(sized, 1, layout.scale, effectRgba),
      shadow: shadowCanvas,
    });
    if (output?.shadow && layout.shadow && sized.shadow) {
      place(
        context,
        shadowCanvas,
        regionOnPage(layout, layout.shadow),
        sized.shadow.offsetX,
        sized.shadow.offsetY
      );
    }
    if (output?.halo && layout.halo) {
      place(context, haloCanvas, regionOnPage(layout, layout.halo));
    }
  }
  drawPhoto(context, mask, 1);
  context.restore();
};
