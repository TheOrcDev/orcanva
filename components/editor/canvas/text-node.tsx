"use client";

import type Konva from "konva";
import { useLayoutEffect, useMemo, useRef } from "react";
import { Rect, Shape } from "react-konva";

import { useFontReady } from "@/hooks/use-font-ready";
import { gradientPoints } from "@/lib/document/geometry";
import type { TextElement, TextGradient } from "@/lib/document/schema";
import {
  FALLBACK_FAMILIES,
  cssFamily,
  getFont,
  nearestWeight,
} from "@/lib/fonts/catalog";
import { canvasFont, canvasMeasurer, paintTextLayout } from "@/lib/text/canvas";
import type { TextPaint } from "@/lib/text/canvas";
import { layoutText } from "@/lib/text/layout";
import type { StyledRun, TextLayout, TextStyle } from "@/lib/text/layout";

export const displayText = (element: TextElement): string =>
  element.uppercase ? element.text.toUpperCase() : element.text;

// Konva strokes are centered on the glyph edge and the fill is painted on
// top, so the visible outline is half the stroke.
export const textStrokeWidth = (element: TextElement): number =>
  element.stroke ? element.stroke.widthEm * element.fontSize * 2 : 0;

export const HIGHLIGHT_NODE_NAME = "text-highlight";
// The shape that draws the text itself
export const TEXT_BODY_NAME = "text-body";

const ALIGN_FACTOR: Record<string, number> = { center: 0.5, left: 0, right: 1 };

// What the text shape draws from. It lives on the node, so a side handle
// can re-wrap the text live by changing only the node's width.
export interface TextShapeInput {
  runs: StyledRun[];
  align: TextElement["align"];
  lineHeight: number;
  paint: TextPaint;
  // Fills the text across its box instead of the paint's fill
  gradient: TextGradient | null;
}

// A gradient across the drawn text (not the whole wrap box), like a page
// background across the page
const gradientFill = (
  context: CanvasRenderingContext2D,
  gradient: TextGradient,
  layout: TextLayout
): CanvasGradient => {
  let left = Number.POSITIVE_INFINITY;
  let right = 0;
  for (const line of layout.lines) {
    left = Math.min(left, line.x);
    right = Math.max(right, line.x + line.width);
  }
  const from = Number.isFinite(left) ? left : 0;
  const { end, start } = gradientPoints(gradient.angle, {
    height: layout.height,
    width: Math.max(1, right - from),
  });
  const fill = context.createLinearGradient(
    from + start.x,
    start.y,
    from + end.x,
    end.y
  );
  for (const stop of gradient.stops.toSorted((a, b) => a.offset - b.offset)) {
    fill.addColorStop(stop.offset, stop.color);
  }
  return fill;
};

const layouts = new WeakMap<
  Konva.Node,
  { input: TextShapeInput; width: number; layout: TextLayout }
>();

export const textLayoutOf = (node: Konva.Node): TextLayout => {
  const input = node.getAttr("textInput") as TextShapeInput;
  const width = node.width();
  const cached = layouts.get(node);
  if (cached && cached.input === input && cached.width === width) {
    return cached.layout;
  }
  const layout = layoutText(
    input.runs,
    { align: input.align, lineHeight: input.lineHeight, width },
    canvasMeasurer
  );
  layouts.set(node, { input, layout, width });
  return layout;
};

const drawText = (context: Konva.Context, shape: Konva.Shape) => {
  const input = shape.getAttr("textInput") as TextShapeInput;
  const native = context._context;
  const layout = textLayoutOf(shape);
  const paint = input.gradient
    ? { ...input.paint, fill: gradientFill(native, input.gradient, layout) }
    : input.paint;
  paintTextLayout(native, layout, () => paint);
};

// Clicks anywhere in the text's box hit it, as with Konva's Text
const hitText = (context: Konva.Context, shape: Konva.Shape) => {
  context.beginPath();
  context.rect(0, 0, shape.width(), shape.height());
  context.closePath();
  context.fillStrokeShape(shape);
};

// The highlight hugs the longest line (not the whole wrap box), offset by
// alignment
export const layoutHighlight = (text: Konva.Node, box: Konva.Node) => {
  const layout = textLayoutOf(text);
  const input = text.getAttr("textInput") as TextShapeInput;
  const padding = Number(box.getAttr("padding") ?? 0);
  const contentWidth = Math.min(text.width(), layout.textWidth);
  const offset =
    (text.width() - contentWidth) * (ALIGN_FACTOR[input.align] ?? 0);
  box.setAttrs({
    height: layout.height + padding * 2,
    width: contentWidth + padding * 2,
    x: offset - padding,
  });
};

export const TextNode = ({ element }: { element: TextElement }) => {
  const textRef = useRef<Konva.Shape>(null);
  const highlightRef = useRef<Konva.Rect>(null);
  const font = getFont(element.fontId);
  const weight = nearestWeight(font, element.weight);
  const italic = element.italic && font.italic;
  const text = displayText(element);
  const ready = useFontReady({
    fontId: font.id,
    italic,
    text,
    weight,
  });

  const { fontSize, highlight, shadow, stroke } = element;
  const padding = highlight ? highlight.paddingEm * fontSize : 0;
  const family = ready ? cssFamily(font) : FALLBACK_FAMILIES[font.category];
  const letterSpacing = element.letterSpacingEm * fontSize;
  const strokeWidth = textStrokeWidth(element);

  const input = useMemo((): TextShapeInput => {
    const style: TextStyle = {
      font: canvasFont({ family, fontSize, italic, weight }),
      fontSize,
      letterSpacing,
    };
    return {
      align: element.align,
      gradient: element.fillGradient,
      lineHeight: element.lineHeight,
      paint: {
        fill: element.fill,
        stroke: stroke && stroke.widthEm > 0 ? stroke.color : null,
        strokeWidth,
      },
      runs: [{ style, text }],
    };
  }, [
    element.align,
    element.fill,
    element.fillGradient,
    element.lineHeight,
    family,
    fontSize,
    italic,
    letterSpacing,
    stroke,
    strokeWidth,
    text,
    weight,
  ]);

  const height = useMemo(
    () =>
      layoutText(
        input.runs,
        {
          align: input.align,
          lineHeight: input.lineHeight,
          width: element.width,
        },
        canvasMeasurer
      ).height,
    [input, element.width]
  );

  // Sized after every render because it depends on measured text
  useLayoutEffect(() => {
    const textNode = textRef.current;
    const box = highlightRef.current;
    if (textNode && box) {
      layoutHighlight(textNode, box);
    }
  });

  return (
    <>
      {highlight ? (
        <Rect
          ref={highlightRef}
          name={HIGHLIGHT_NODE_NAME}
          padding={padding}
          y={-padding}
          fill={highlight.color}
          cornerRadius={highlight.radiusEm * fontSize}
        />
      ) : null}
      <Shape
        ref={textRef}
        name={TEXT_BODY_NAME}
        textInput={input}
        width={element.width}
        height={height}
        fill={element.fill}
        sceneFunc={drawText}
        hitFunc={hitText}
        shadowEnabled={shadow !== null}
        shadowColor={shadow?.color}
        shadowBlur={(shadow?.blurEm ?? 0) * fontSize}
        shadowOffsetX={(shadow?.offsetXEm ?? 0) * fontSize}
        shadowOffsetY={(shadow?.offsetYEm ?? 0) * fontSize}
        shadowOpacity={1}
        perfectDrawEnabled={false}
      />
    </>
  );
};
