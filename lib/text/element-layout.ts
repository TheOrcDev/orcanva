import type { Size } from "@/lib/document/geometry";
import type { TextElement } from "@/lib/document/schema";
import {
  FALLBACK_FAMILIES,
  cssFamily,
  getFont,
  nearestWeight,
} from "@/lib/fonts/catalog";
import type { FontRequest } from "@/lib/fonts/loader";
import { canvasFont } from "@/lib/text/canvas";
import { curveText } from "@/lib/text/curve";
import { layoutText } from "@/lib/text/layout";
import type {
  Measurer,
  StyledRun,
  TextLayout,
  TextStyle,
} from "@/lib/text/layout";
import { styledSegments } from "@/lib/text/marks";
import type { MarkStyle } from "@/lib/text/marks";

// How a text element lays out, outside Konva: the canvas text node draws
// from these runs, and Magic Resize measures with them. Measuring is passed
// in, so this runs without a canvas too.

// A run's style: its own colour when a mark sets one
export interface RunStyle extends TextStyle {
  fill: string | null;
}

// Whether a font face has loaded; faces still loading draw (and measure)
// in a fallback family
export type FontReady = (request: FontRequest) => boolean;

// How a stretch of text with some marks' style draws, and the font face it
// needs
const styleFor = (
  element: TextElement,
  style: MarkStyle,
  text: string,
  isReady: FontReady
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
        family: isReady(request)
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

export interface TextRuns {
  // Every face the text needs
  fonts: FontRequest[];
  runs: StyledRun<RunStyle>[];
  // The text's own style, which every line makes room for
  strut: RunStyle;
}

// The text cut into runs where its marks change its style, its own style
// (which every line makes room for), and the faces they all need
export const textRunsOf = (
  element: TextElement,
  isReady: FontReady
): TextRuns => {
  const own = styleFor(element, {}, "", isReady);
  const fonts: FontRequest[] = [own.request];
  const runs: StyledRun<RunStyle>[] = [];
  for (const segment of styledSegments(element.text, element.marks)) {
    // Per run, since uppercasing can change a string's length
    const text = element.uppercase ? segment.text.toUpperCase() : segment.text;
    const { request, style } = styleFor(element, segment.style, text, isReady);
    fonts.push(request);
    runs.push({ style, text });
  }
  return { fonts, runs, strut: own.style };
};

// A line that ends inside a word: the next line in the same paragraph
// starts right where it stopped (a break at a space drops the space) and
// it doesn't end on a dash
const splitsWords = (layout: TextLayout): boolean =>
  layout.lines.some((line, index) => {
    const next = layout.lines[index + 1];
    const last = line.pieces.at(-1);
    if (!(next && last)) {
      return false;
    }
    const end = last.offset + last.text.length;
    return next.offset === end && !last.text.endsWith("-");
  });

export interface TextMeasure extends Size {
  // How wide the drawn text is: the longest line, or the arc
  inkWidth: number;
  // A word had to be broken across lines to fit the width
  splitsWords: boolean;
}

export interface TextShape {
  align: TextElement["align"];
  lineHeight: number;
  // Bends the text along a circle (one line) when not 0
  curve: number;
  // The wrap width of straight text
  width: number;
}

// The box runs draw in: straight text wraps at its width and is as tall as
// its lines; curved text is as big as its arc
export const measureRuns = (
  { runs, strut }: Pick<TextRuns, "runs" | "strut">,
  shape: TextShape,
  measurer: Measurer
): TextMeasure => {
  if (shape.curve !== 0) {
    const curved = curveText(runs, shape.curve, measurer);
    return {
      height: curved.height,
      inkWidth: curved.width,
      splitsWords: false,
      width: curved.width,
    };
  }
  const layout = layoutText(
    runs,
    {
      align: shape.align,
      lineHeight: shape.lineHeight,
      strut,
      width: shape.width,
    },
    measurer
  );
  return {
    height: layout.height,
    inkWidth: Math.min(layout.textWidth, shape.width),
    splitsWords: splitsWords(layout),
    width: shape.width,
  };
};

// The box a text element draws in, measured with `measurer`
export const measureTextElement = (
  element: TextElement,
  measurer: Measurer,
  isReady: FontReady
): TextMeasure => measureRuns(textRunsOf(element, isReady), element, measurer);
