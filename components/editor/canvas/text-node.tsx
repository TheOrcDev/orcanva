"use client";

import type Konva from "konva";
import { useLayoutEffect, useRef } from "react";
import { Rect, Text } from "react-konva";

import { useFontReady } from "@/hooks/use-font-ready";
import type { TextElement } from "@/lib/document/schema";
import {
  FALLBACK_FAMILIES,
  cssFamily,
  getFont,
  konvaFontStyle,
  nearestWeight,
} from "@/lib/fonts/catalog";

export const displayText = (element: TextElement): string =>
  element.uppercase ? element.text.toUpperCase() : element.text;

// Konva strokes are centered on the glyph edge and the fill is painted on
// top (fillAfterStrokeEnabled), so the visible outline is half the stroke.
export const textStrokeWidth = (element: TextElement): number =>
  element.stroke ? element.stroke.widthEm * element.fontSize * 2 : 0;

export const TextNode = ({ element }: { element: TextElement }) => {
  const textRef = useRef<Konva.Text>(null);
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

  // The highlight box hugs the measured text, which Konva only knows after
  // laying it out, so size it imperatively after each render
  useLayoutEffect(() => {
    const textNode = textRef.current;
    const box = highlightRef.current;
    if (!textNode || !box) {
      return;
    }
    box.setAttrs({
      height: textNode.height() + padding * 2,
      width: textNode.width() + padding * 2,
    });
  });

  return (
    <>
      {highlight ? (
        <Rect
          ref={highlightRef}
          name="text-highlight"
          x={-padding}
          y={-padding}
          fill={highlight.color}
          cornerRadius={highlight.radiusEm * fontSize}
        />
      ) : null}
      <Text
        ref={textRef}
        text={text}
        width={element.width}
        fontFamily={ready ? cssFamily(font) : FALLBACK_FAMILIES[font.category]}
        fontStyle={konvaFontStyle(weight, italic)}
        fontSize={fontSize}
        lineHeight={element.lineHeight}
        letterSpacing={element.letterSpacingEm * fontSize}
        align={element.align}
        fill={element.fill}
        wrap="word"
        stroke={stroke?.color}
        strokeWidth={textStrokeWidth(element)}
        strokeEnabled={stroke !== null && stroke.widthEm > 0}
        fillAfterStrokeEnabled
        lineJoin="round"
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
