import type { Size } from "@/lib/document/geometry";
import type { GraphicElement, GraphicLayer } from "@/lib/document/schema";
import { paletteColor } from "@/lib/graphics/paint";

// What drawing a graphic needs from its element
export type GraphicPaint = Pick<
  GraphicElement,
  | "flipX"
  | "flipY"
  | "layers"
  | "outline"
  | "palette"
  | "strokeScale"
  | "viewBox"
>;

export type Matrix = [number, number, number, number, number, number];

// Maps the art's viewBox onto the element's box, mirrored inside it the way
// photos are, so x, y and size mean the same whichever way it faces
export const artTransform = (
  viewBox: GraphicElement["viewBox"],
  size: Size,
  flipX: boolean,
  flipY: boolean
): Matrix => {
  const [minX, minY, artWidth, artHeight] = viewBox;
  const sx = size.width / artWidth;
  const sy = size.height / artHeight;
  return [
    flipX ? -sx : sx,
    0,
    0,
    flipY ? -sy : sy,
    flipX ? size.width + minX * sx : -minX * sx,
    flipY ? size.height + minY * sy : -minY * sy,
  ];
};

// How far the outline reaches past the art, in viewBox units
export const outlineReach = (
  paint: Pick<GraphicPaint, "outline" | "viewBox">
) => (paint.outline?.width ?? 0) * Math.min(paint.viewBox[2], paint.viewBox[3]);

// Whether a layer paints anything: an outline only follows what shows
const layerShows = (paint: GraphicPaint, layer: GraphicLayer): boolean =>
  layer.opacity > 0 &&
  (paletteColor(paint.palette, layer.fill) !== null ||
    (paletteColor(paint.palette, layer.stroke) !== null &&
      layer.strokeWidth > 0));

// Path data parses once per layer object; edits that keep the layers (a
// recolour, a resize) reuse them
const paths = new WeakMap<GraphicLayer, Path2D>();
const pathOf = (layer: GraphicLayer): Path2D => {
  let path = paths.get(layer);
  if (!path) {
    path = new Path2D(layer.d);
    paths.set(layer, path);
  }
  return path;
};

// SVG's default; canvas would sharpen joins up to 10
const SVG_MITER_LIMIT = 4;

// The die-cut border: every layer that shows, filled and stroked wide in
// the outline colour with round joins, under the art
const paintOutline = (
  context: CanvasRenderingContext2D,
  paint: GraphicPaint
) => {
  const reach = outlineReach(paint);
  if (!paint.outline || reach <= 0) {
    return;
  }
  context.fillStyle = paint.outline.color;
  context.strokeStyle = paint.outline.color;
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const layer of paint.layers) {
    if (!layerShows(paint, layer)) {
      continue;
    }
    const path = pathOf(layer);
    const stroked = paletteColor(paint.palette, layer.stroke) !== null;
    if (paletteColor(paint.palette, layer.fill) !== null) {
      context.fill(path, layer.fillRule);
    }
    context.lineWidth =
      reach * 2 + (stroked ? layer.strokeWidth * paint.strokeScale : 0);
    context.stroke(path);
  }
};

// Draws a graphic into a box at the origin of the context's current space.
// Vectors all the way, so it's sharp at any zoom and in 2× exports.
export const paintGraphic = (
  context: CanvasRenderingContext2D,
  paint: GraphicPaint,
  size: Size
) => {
  context.save();
  context.transform(
    ...artTransform(paint.viewBox, size, paint.flipX, paint.flipY)
  );
  context.miterLimit = SVG_MITER_LIMIT;
  const alpha = context.globalAlpha;
  paintOutline(context, paint);
  for (const layer of paint.layers) {
    const fill = paletteColor(paint.palette, layer.fill);
    const stroke = paletteColor(paint.palette, layer.stroke);
    const strokeWidth = layer.strokeWidth * paint.strokeScale;
    if (!layerShows(paint, layer)) {
      continue;
    }
    const path = pathOf(layer);
    context.globalAlpha = alpha * layer.opacity;
    if (fill !== null) {
      context.fillStyle = fill;
      context.fill(path, layer.fillRule);
    }
    if (stroke !== null && strokeWidth > 0) {
      context.strokeStyle = stroke;
      context.lineWidth = strokeWidth;
      context.lineCap = layer.lineCap;
      context.lineJoin = layer.lineJoin;
      context.stroke(path);
    }
  }
  context.restore();
};
