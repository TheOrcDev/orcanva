"use client";

import type Konva from "konva";
import { useMemo } from "react";
import { Shape } from "react-konva";

import type { GraphicElement } from "@/lib/document/schema";
import { paintGraphic } from "@/lib/graphics/draw";
import type { GraphicPaint } from "@/lib/graphics/draw";

const PAINT_ATTR = "graphicPaint";

const drawGraphic = (context: Konva.Context, shape: Konva.Shape) => {
  const paint = shape.getAttr(PAINT_ATTR) as GraphicPaint | undefined;
  if (paint) {
    paintGraphic(context._context, paint, shape.size());
  }
};

// Clicks anywhere in the box hit it, so thin icons are easy to grab
const hitBox = (context: Konva.Context, shape: Konva.Shape) => {
  context.beginPath();
  context.rect(0, 0, shape.width(), shape.height());
  context.closePath();
  context.fillShape(shape);
};

// Never painted: a shape with both a fill and a stroke is drawn through a
// buffer while it's see-through (Konva's perfect drawing), so the graphic's
// overlapping layers fade as one picture instead of showing through each
// other. Selection boxes and snapping skip strokes, so the hairline width
// changes no bounds.
const BUFFER_PAINT = {
  fill: "#000000",
  perfectDrawEnabled: true,
  stroke: "#000000",
  strokeWidth: 0.001,
} as const;

// Icons, emoji and stickers: their vector art drawn into the element's box,
// with its outline reaching past it
export const GraphicNode = ({ element }: { element: GraphicElement }) => {
  const { flipX, flipY, layers, outline, palette, strokeScale, viewBox } =
    element;
  const paint = useMemo(
    (): GraphicPaint => ({
      flipX,
      flipY,
      layers,
      outline,
      palette,
      strokeScale,
      viewBox,
    }),
    [flipX, flipY, layers, outline, palette, strokeScale, viewBox]
  );

  return (
    <Shape
      {...BUFFER_PAINT}
      width={element.width}
      height={element.height}
      sceneFunc={drawGraphic}
      hitFunc={hitBox}
      // Read back as PAINT_ATTR
      graphicPaint={paint}
    />
  );
};
