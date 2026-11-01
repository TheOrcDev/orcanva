// Lays out styled text the way Konva's Text does for one style (same
// wrapping, line height and baseline), and extends it to runs of different
// styles in one box. Measuring is passed in, so this runs without a canvas.

export interface TextStyle {
  // A canvas font string: style, weight, size and family
  font: string;
  fontSize: number;
  // Extra space after every character, in pixels
  letterSpacing: number;
  underline?: boolean;
  strike?: boolean;
}

export interface StyledRun<S extends TextStyle = TextStyle> {
  text: string;
  style: S;
}

export interface FontBox {
  // Distances from the alphabetic baseline to the top and bottom of the font
  ascent: number;
  descent: number;
}

export interface Measurer {
  // Advance width of text in a style (kerning off when letters are spaced,
  // as Konva draws spaced text one letter at a time)
  width: (text: string, style: TextStyle) => number;
  fontBox: (style: TextStyle) => FontBox;
}

export type TextAlign = "left" | "center" | "right";

export interface LayoutOptions {
  // Wrap width; null lays every paragraph out on one line
  width: number | null;
  align: TextAlign;
  // Multiple of the largest font size on each line
  lineHeight: number;
}

// A stretch of one line in one style
export interface LaidOutPiece<S extends TextStyle = TextStyle> {
  text: string;
  style: S;
  // From the line's start, and its advance including letter spacing
  x: number;
  width: number;
  // Where it starts in the full text, in UTF-16 code units
  offset: number;
}

export interface LaidOutLine<S extends TextStyle = TextStyle> {
  pieces: LaidOutPiece<S>[];
  // Left edge after alignment, and the line's own width
  x: number;
  width: number;
  top: number;
  height: number;
  // The alphabetic baseline, from the top of the text
  baseline: number;
  // Where the line starts in the full text (for an empty line too)
  offset: number;
}

export interface TextLayout<S extends TextStyle = TextStyle> {
  lines: LaidOutLine<S>[];
  // The widest line
  textWidth: number;
  height: number;
}

interface Grapheme {
  text: string;
  run: number;
  offset: number;
}

const segmenter =
  typeof Intl === "undefined"
    ? null
    : new Intl.Segmenter(undefined, { granularity: "grapheme" });

const graphemesOf = (text: string): string[] =>
  segmenter
    ? Array.from(segmenter.segment(text), (part) => part.segment)
    : [...text];

const isBreak = (grapheme: string | undefined) =>
  grapheme === " " || grapheme === "-";
const isSpace = (grapheme: string | undefined) =>
  grapheme !== undefined && grapheme.trim() === "";

// Paragraphs of graphemes, each knowing its run and place in the text
const paragraphsOf = <S extends TextStyle>(
  runs: readonly StyledRun<S>[]
): { graphemes: Grapheme[]; offset: number; run: number }[] => {
  const paragraphs: { graphemes: Grapheme[]; offset: number; run: number }[] = [
    { graphemes: [], offset: 0, run: 0 },
  ];
  let offset = 0;
  for (const [run, { text }] of runs.entries()) {
    for (const grapheme of graphemesOf(text)) {
      if (grapheme === "\n") {
        paragraphs.push({ graphemes: [], offset: offset + 1, run });
      } else {
        paragraphs.at(-1)?.graphemes.push({ offset, run, text: grapheme });
      }
      offset += grapheme.length;
    }
  }
  return paragraphs;
};

// The longest prefix from `start` that fits, at least one grapheme
const fittingEnd = (
  start: number,
  length: number,
  fits: (end: number) => boolean
): number => {
  let low = start;
  let high = length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (fits(middle)) {
      low = middle;
    } else {
      high = middle - 1;
    }
  }
  return low === start ? start + 1 : low;
};

// Where a too-long paragraph's lines start and end: Konva's word wrap, which
// breaks after the last space or dash that fits, drops spaces at the break,
// and splits a word only when nothing else fits
const wrapParagraph = (
  graphemes: readonly Grapheme[],
  fits: (start: number, end: number) => boolean
): [number, number][] => {
  const { length } = graphemes;
  const ranges: [number, number][] = [];
  let start = 0;
  while (start < length) {
    const from = start;
    let low = fittingEnd(from, length, (end) => fits(from, end));
    if (low >= length) {
      ranges.push([start, length]);
      break;
    }
    if (!isBreak(graphemes[low]?.text)) {
      let wrap = low - 1;
      while (wrap >= start && !isBreak(graphemes[wrap]?.text)) {
        wrap -= 1;
      }
      if (wrap >= start) {
        low = wrap + 1;
      }
    }
    let end = low;
    while (end > start && isSpace(graphemes[end - 1]?.text)) {
      end -= 1;
    }
    ranges.push([start, end]);
    start = low;
    while (start < length && isSpace(graphemes[start]?.text)) {
      start += 1;
    }
  }
  return ranges;
};

const totalWidth = (pieces: readonly { width: number }[]): number => {
  let sum = 0;
  for (const piece of pieces) {
    sum += piece.width;
  }
  return sum;
};

const alignOffset = (align: TextAlign, free: number): number => {
  if (align === "right") {
    return free;
  }
  return align === "center" ? free / 2 : 0;
};

interface OpenLine<S extends TextStyle> {
  pieces: LaidOutPiece<S>[];
  width: number;
  offset: number;
  // The style an empty line takes its height from
  style: S | undefined;
}

// Each line is as tall as its largest font, with the baseline placed the way
// Konva places it for one font: centred by the font's box
const placeLines = <S extends TextStyle>(
  lines: readonly OpenLine<S>[],
  options: LayoutOptions,
  measure: Measurer
): TextLayout<S> => {
  let top = 0;
  let textWidth = 0;
  const placed = lines.map(({ pieces, width, offset, style }) => {
    const styles = pieces.length > 0 ? pieces.map((piece) => piece.style) : [];
    if (styles.length === 0 && style) {
      styles.push(style);
    }
    let fontSize = 0;
    let ascent = 0;
    let descent = 0;
    for (const item of styles) {
      const box = measure.fontBox(item);
      fontSize = Math.max(fontSize, item.fontSize);
      ascent = Math.max(ascent, box.ascent);
      descent = Math.max(descent, box.descent);
    }
    const height = options.lineHeight * fontSize;
    const line: LaidOutLine<S> = {
      baseline: top + (ascent - descent) / 2 + height / 2,
      height,
      offset,
      pieces,
      top,
      width,
      x: alignOffset(options.align, (options.width ?? width) - width),
    };
    top += height;
    textWidth = Math.max(textWidth, width);
    return line;
  });
  return { height: top, lines: placed, textWidth };
};

export const layoutText = <S extends TextStyle>(
  runs: readonly StyledRun<S>[],
  options: LayoutOptions,
  measure: Measurer
): TextLayout<S> => {
  // Pieces for graphemes [start, end) of a paragraph: one per run
  const piecesOf = (
    graphemes: readonly Grapheme[],
    start: number,
    end: number
  ): LaidOutPiece<S>[] => {
    const pieces: LaidOutPiece<S>[] = [];
    let x = 0;
    let index = start;
    while (index < end) {
      const first = graphemes[index];
      const style = first ? runs[first.run]?.style : undefined;
      if (!(first && style)) {
        break;
      }
      let last = index + 1;
      while (last < end && graphemes[last]?.run === first.run) {
        last += 1;
      }
      const slice = graphemes.slice(index, last);
      const text = slice.map((grapheme) => grapheme.text).join("");
      const width =
        measure.width(text, style) + style.letterSpacing * slice.length;
      pieces.push({ offset: first.offset, style, text, width, x });
      x += width;
      index = last;
    }
    return pieces;
  };

  const lines: OpenLine<S>[] = [];
  for (const paragraph of paragraphsOf(runs)) {
    const { graphemes } = paragraph;
    const lineOf = (start: number, end: number): OpenLine<S> => {
      const pieces = piecesOf(graphemes, start, end);
      const first = graphemes[start];
      return {
        offset: first?.offset ?? paragraph.offset,
        pieces,
        style: runs[first?.run ?? paragraph.run]?.style,
        width: totalWidth(pieces),
      };
    };
    const whole = lineOf(0, graphemes.length);
    const max = options.width;
    if (max === null || whole.width <= max) {
      lines.push(whole);
      continue;
    }
    const fits = (start: number, end: number) =>
      totalWidth(piecesOf(graphemes, start, end)) <= max;
    for (const [start, end] of wrapParagraph(graphemes, fits)) {
      lines.push(lineOf(start, end));
    }
  }
  return placeLines(lines, options, measure);
};
