import {
  MAX_GRAPHIC_OUTLINE,
  MAX_STROKE_SCALE,
  MIN_STROKE_SCALE,
} from "@/lib/document/schema";
import type { GraphicElement, GraphicOutline } from "@/lib/document/schema";
import { outlineReach } from "@/lib/graphics/draw";
import type { GraphicArt } from "@/lib/graphics/entry";
import { paintedIndexes } from "@/lib/graphics/paint";

// The swatches a graphic's panel shows: one per palette entry it paints with
export interface PaletteSwatch {
  index: number;
  color: string;
}

export const paletteSwatches = (graphic: GraphicElement): PaletteSwatch[] =>
  paintedIndexes(graphic).flatMap((index) => {
    const color = graphic.palette[index];
    return color === undefined ? [] : [{ color, index }];
  });

// The palette with one entry recoloured: every layer using it follows
export const withPaletteColor = (
  graphic: Pick<GraphicElement, "palette">,
  index: number,
  color: string
): Pick<GraphicElement, "palette"> => ({
  palette: graphic.palette.map((current, at) =>
    at === index ? color : current
  ),
});

// Whether any layer draws a line, so line weight changes something
export const hasStrokes = (graphic: GraphicElement): boolean =>
  graphic.layers.some(
    (layer) =>
      layer.stroke !== null && layer.strokeWidth > 0 && layer.opacity > 0
  );

export const clampStrokeScale = (scale: number): number =>
  Math.min(MAX_STROKE_SCALE, Math.max(MIN_STROKE_SCALE, scale));

// What turning the outline on gives: white, a little over a twentieth of
// the art's shorter side, the classic sticker look
export const DEFAULT_GRAPHIC_OUTLINE: GraphicOutline = {
  color: "#ffffff",
  width: 0.06,
};

// Page px per viewBox unit along the box's shorter scale
const boxScale = (graphic: GraphicElement): number =>
  Math.min(
    graphic.width / graphic.viewBox[2],
    graphic.height / graphic.viewBox[3]
  );

// How far the outline reaches past the art on the page, in px
export const outlinePx = (graphic: GraphicElement): number =>
  outlineReach(graphic) * boxScale(graphic);

// The most the outline slider offers, in page px
export const maxOutlinePx = (graphic: GraphicElement): number =>
  MAX_GRAPHIC_OUTLINE *
  Math.min(graphic.viewBox[2], graphic.viewBox[3]) *
  boxScale(graphic);

// An outline reaching `px` page px past the art at the graphic's size
export const outlineAtPx = (
  graphic: GraphicElement,
  px: number
): GraphicOutline | null => {
  if (!graphic.outline) {
    return null;
  }
  const side = Math.min(graphic.viewBox[2], graphic.viewBox[3]);
  const width = px / boxScale(graphic) / side;
  return {
    ...graphic.outline,
    width: Math.min(MAX_GRAPHIC_OUTLINE, Math.max(0, width)),
  };
};

// The art's own colours back, or null when they already are (so pressing
// Reset twice makes no undo step)
export const resetColorsPatch = (
  graphic: GraphicElement,
  original: Pick<GraphicArt, "palette">
): Pick<GraphicElement, "palette"> | null => {
  const same =
    original.palette.length === graphic.palette.length &&
    original.palette.every((color, index) => graphic.palette[index] === color);
  return same ? null : { palette: [...original.palette] };
};
