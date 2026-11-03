"use client";

import type Konva from "konva";
import { useLayoutEffect, useMemo, useRef } from "react";
import { Rect, Shape } from "react-konva";

import { useEditor } from "@/components/editor/editor-store-context";
import { useFontsReady } from "@/hooks/use-fonts-ready";
import { gradientPoints } from "@/lib/document/geometry";
import type {
  TextEffect,
  TextElement,
  TextGradient,
} from "@/lib/document/schema";
import {
  FALLBACK_FAMILIES,
  cssFamily,
  getFont,
  nearestWeight,
} from "@/lib/fonts/catalog";
import { isFontReady } from "@/lib/fonts/loader";
import type { FontRequest } from "@/lib/fonts/loader";
import {
  canvasFont,
  canvasMeasurer,
  paintCurvedText,
  paintTextLayout,
} from "@/lib/text/canvas";
import type { TextPaint } from "@/lib/text/canvas";
import { curveText } from "@/lib/text/curve";
import type { CurvedLayout } from "@/lib/text/curve";
import { paintWithEffect } from "@/lib/text/effects";
import type { DeviceScale } from "@/lib/text/effects";
import { layoutText } from "@/lib/text/layout";
import type { StyledRun, TextLayout, TextStyle } from "@/lib/text/layout";
import { styledSegments } from "@/lib/text/marks";
import type { MarkStyle } from "@/lib/text/marks";

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
// A run's style: its own colour when a mark sets one
export interface RunStyle extends TextStyle {
  fill: string | null;
}

export interface TextShapeInput {
  runs: StyledRun<RunStyle>[];
  // The text's own style: every line makes room for it
  strut: RunStyle;
  align: TextElement["align"];
  lineHeight: number;
  paint: TextPaint;
  // Fills the text across its box instead of the paint's fill
  gradient: TextGradient | null;
  // Bent along a circle (one line) when not 0
  curve: number;
  effect: TextEffect | null;
  // The element's font size, which effect offsets are relative to
  fontSize: number;
}

// Paints the text through its effect: `paintOnce` draws it with a paint
const paintThroughEffect = (
  context: CanvasRenderingContext2D,
  deviceScale: DeviceScale,
  input: TextShapeInput,
  paint: TextPaint,
  paintOnce: (paint: TextPaint) => void
) =>
  paintWithEffect({
    context,
    deviceScale,
    draw: (pass, dx, dy) => {
      context.save();
      context.translate(dx, dy);
      paintOnce(pass);
      context.restore();
    },
    effect: input.effect,
    fontSize: input.fontSize,
    paint,
  });

// The part of the box the drawn text covers, which a gradient spans
interface InkBox {
  left: number;
  width: number;
  height: number;
}

const inkOfLines = (layout: TextLayout): InkBox => {
  let left = Number.POSITIVE_INFINITY;
  let right = 0;
  for (const line of layout.lines) {
    left = Math.min(left, line.x);
    right = Math.max(right, line.x + line.width);
  }
  const from = Number.isFinite(left) ? left : 0;
  return {
    height: layout.height,
    left: from,
    width: Math.max(1, right - from),
  };
};

// A gradient across the drawn text (not the whole wrap box), like a page
// background across the page
const gradientFill = (
  context: CanvasRenderingContext2D,
  gradient: TextGradient,
  ink: InkBox
): CanvasGradient => {
  const { end, start } = gradientPoints(gradient.angle, ink);
  const fill = context.createLinearGradient(
    ink.left + start.x,
    start.y,
    ink.left + end.x,
    end.y
  );
  for (const stop of gradient.stops.toSorted((a, b) => a.offset - b.offset)) {
    fill.addColorStop(stop.offset, stop.color);
  }
  return fill;
};

const layouts = new WeakMap<
  Konva.Node,
  { input: TextShapeInput; width: number; layout: TextLayout<RunStyle> }
>();

export const textLayoutOf = (node: Konva.Node): TextLayout<RunStyle> => {
  const input = node.getAttr("textInput") as TextShapeInput;
  const width = node.width();
  const cached = layouts.get(node);
  if (cached && cached.input === input && cached.width === width) {
    return cached.layout;
  }
  const layout = layoutText(
    input.runs,
    {
      align: input.align,
      lineHeight: input.lineHeight,
      strut: input.strut,
      width,
    },
    canvasMeasurer
  );
  layouts.set(node, { input, layout, width });
  return layout;
};

// A run with its own colour keeps it in the text's own pass; an effect's
// copies (new paints) keep the effect's colours
const runPaint = (
  style: RunStyle,
  pass: TextPaint,
  base: TextPaint
): TextPaint =>
  pass === base && style.fill ? { ...pass, fill: style.fill } : pass;

const curvedLayouts = new WeakMap<
  Konva.Node,
  { input: TextShapeInput; layout: CurvedLayout<RunStyle> }
>();

export const curvedLayoutOf = (node: Konva.Node): CurvedLayout<RunStyle> => {
  const input = node.getAttr("textInput") as TextShapeInput;
  const cached = curvedLayouts.get(node);
  if (cached?.input === input) {
    return cached.layout;
  }
  const layout = curveText(input.runs, input.curve, canvasMeasurer);
  curvedLayouts.set(node, { input, layout });
  return layout;
};

// Device pixels per page unit where this shape is drawn, worked out as Konva
// does for its own shadows (zoom, the export's pixel ratio)
const deviceScaleOf = (
  context: Konva.Context,
  shape: Konva.Shape
): DeviceScale => {
  const scale = shape.getAbsoluteScale();
  const ratio = context.canvas.getPixelRatio();
  return { x: scale.x * ratio, y: scale.y * ratio };
};

const drawText = (context: Konva.Context, shape: Konva.Shape) => {
  const input = shape.getAttr("textInput") as TextShapeInput;
  const native = context._context;
  const deviceScale = deviceScaleOf(context, shape);
  if (input.curve !== 0) {
    const curved = curvedLayoutOf(shape);
    const paint = input.gradient
      ? {
          ...input.paint,
          fill: gradientFill(native, input.gradient, {
            height: curved.height,
            left: 0,
            width: curved.width,
          }),
        }
      : input.paint;
    paintThroughEffect(native, deviceScale, input, paint, (pass) =>
      paintCurvedText(native, curved, (style) => runPaint(style, pass, paint))
    );
    return;
  }
  const layout = textLayoutOf(shape);
  const paint = input.gradient
    ? {
        ...input.paint,
        fill: gradientFill(native, input.gradient, inkOfLines(layout)),
      }
    : input.paint;
  paintThroughEffect(native, deviceScale, input, paint, (pass) =>
    paintTextLayout(native, layout, (style) => runPaint(style, pass, paint))
  );
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

// How a stretch of text with some marks' style draws, and the font face it
// needs. Faces still loading draw in a fallback family.
const styleFor = (
  element: TextElement,
  style: MarkStyle,
  text: string
): { request: FontRequest; style: RunStyle } => {
  const font = getFont(style.fontId ?? element.fontId);
  const weight = nearestWeight(font, style.weight ?? element.weight);
  const italic = (style.italic ?? element.italic) && font.italic;
  const fontSize = element.fontSize * (style.sizeEm ?? 1);
  const request = { fontId: font.id, italic, text, weight };
  return {
    request,
    style: {
      fill: style.fill ?? null,
      font: canvasFont({
        family: isFontReady(request)
          ? cssFamily(font)
          : FALLBACK_FAMILIES[font.category],
        fontSize,
        italic,
        weight,
      }),
      fontSize,
      letterSpacing: element.letterSpacingEm * fontSize,
      strike: style.strike ?? element.strike,
      underline: style.underline ?? element.underline,
    },
  };
};

// The text cut into runs where its marks change its style, its own style
// (which every line makes room for), and the faces they all need
const runsOf = (
  element: TextElement
): { fonts: FontRequest[]; runs: StyledRun<RunStyle>[]; strut: RunStyle } => {
  const own = styleFor(element, {}, "");
  const fonts: FontRequest[] = [own.request];
  const runs: StyledRun<RunStyle>[] = [];
  for (const segment of styledSegments(element.text, element.marks)) {
    // Per run, since uppercasing can change a string's length
    const text = element.uppercase ? segment.text.toUpperCase() : segment.text;
    const { request, style } = styleFor(element, segment.style, text);
    fonts.push(request);
    runs.push({ style, text });
  }
  return { fonts, runs, strut: own.style };
};

export const TextNode = ({ element }: { element: TextElement }) => {
  const textRef = useRef<Konva.Shape>(null);
  const highlightRef = useRef<Konva.Rect>(null);
  const { fonts, runs, strut } = runsOf(element);
  useFontsReady(fonts);
  // Stands for the runs, so the input only changes when they do
  const runsKey = JSON.stringify({ runs, strut });

  const { fontSize, shadow, stroke } = element;
  // Typing straightens curved text, so the caret lines up with it
  const editing = useEditor((state) => state.editingTextId === element.id);
  const curve = editing ? 0 : element.curve;
  // A highlight hugs lines, which curved text doesn't have
  const highlight = curve === 0 ? element.highlight : null;
  const padding = highlight ? highlight.paddingEm * fontSize : 0;
  const strokeWidth = textStrokeWidth(element);

  const input = useMemo(
    (): TextShapeInput => ({
      align: element.align,
      curve,
      effect: element.effect,
      fontSize,
      gradient: element.fillGradient,
      lineHeight: element.lineHeight,
      paint: {
        fill: element.fill,
        stroke: stroke && stroke.widthEm > 0 ? stroke.color : null,
        strokeWidth,
      },
      ...(JSON.parse(runsKey) as {
        runs: StyledRun<RunStyle>[];
        strut: RunStyle;
      }),
    }),
    [
      curve,
      element.effect,
      element.align,
      element.fill,
      element.fillGradient,
      element.lineHeight,
      fontSize,
      runsKey,
      stroke,
      strokeWidth,
    ]
  );

  // Straight text wraps at the element's width; curved text is as big as
  // its arc
  const size = useMemo(() => {
    if (input.curve !== 0) {
      const curved = curveText(input.runs, input.curve, canvasMeasurer);
      return { height: curved.height, width: curved.width };
    }
    const layout = layoutText(
      input.runs,
      {
        align: input.align,
        lineHeight: input.lineHeight,
        strut: input.strut,
        width: element.width,
      },
      canvasMeasurer
    );
    return { height: layout.height, width: element.width };
  }, [input, element.width]);

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
        // An arc stays centred where the straight text was
        x={(element.width - size.width) / 2}
        width={size.width}
        height={size.height}
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
