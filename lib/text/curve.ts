import type { Measurer, StyledRun, TextStyle } from "@/lib/text/layout";

// At ±100 the text goes almost all the way round a circle
const FULL_TURN = Math.PI * 2 * 0.95;

export interface CurvedGlyph<S extends TextStyle = TextStyle> {
  text: string;
  style: S;
  // Where the glyph's baseline centre sits, and its turn in radians
  x: number;
  y: number;
  rotation: number;
  // Its advance, including letter spacing
  width: number;
}

export interface CurvedLayout<S extends TextStyle = TextStyle> {
  glyphs: CurvedGlyph<S>[];
  // The box around every glyph, which glyph positions start at
  width: number;
  height: number;
}

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" });

// Bends text along a circle, one line, letter by letter. Positive curves
// arch up like a rainbow (letters lean out from the centre), negative ones
// dip like a smile (letters lean in). `curve` runs from -100 to 100.
export const curveText = <S extends TextStyle>(
  runs: readonly StyledRun<S>[],
  curve: number,
  measure: Measurer
): CurvedLayout<S> => {
  const letters: { text: string; style: S; width: number }[] = [];
  for (const { style, text } of runs) {
    for (const { segment } of segmenter.segment(text.replaceAll("\n", " "))) {
      letters.push({
        style,
        text: segment,
        width: measure.width(segment, style) + style.letterSpacing,
      });
    }
  }
  let length = 0;
  for (const letter of letters) {
    length += letter.width;
  }
  const turn = (Math.min(100, Math.abs(curve)) / 100) * FULL_TURN;
  const radius = turn > 0 ? length / turn : Number.POSITIVE_INFINITY;
  const up = curve >= 0 ? 1 : -1;

  // Around the arc's middle, then boxed
  let along = 0;
  const placed = letters.map((letter) => {
    const angle = Number.isFinite(radius)
      ? (along + letter.width / 2 - length / 2) / radius
      : 0;
    const x = Number.isFinite(radius)
      ? radius * Math.sin(angle)
      : along + letter.width / 2 - length / 2;
    const y = Number.isFinite(radius)
      ? up * (radius - radius * Math.cos(angle))
      : 0;
    along += letter.width;
    return { ...letter, rotation: up * angle, x, y };
  });

  let left = Number.POSITIVE_INFINITY;
  let top = Number.POSITIVE_INFINITY;
  let right = Number.NEGATIVE_INFINITY;
  let bottom = Number.NEGATIVE_INFINITY;
  for (const glyph of placed) {
    const { ascent, descent } = measure.fontBox(glyph.style);
    const cos = Math.cos(glyph.rotation);
    const sin = Math.sin(glyph.rotation);
    for (const [cornerX, cornerY] of [
      [-glyph.width / 2, -ascent],
      [glyph.width / 2, -ascent],
      [-glyph.width / 2, descent],
      [glyph.width / 2, descent],
    ] as const) {
      const x = glyph.x + cornerX * cos - cornerY * sin;
      const y = glyph.y + cornerX * sin + cornerY * cos;
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  }
  if (placed.length === 0) {
    return { glyphs: [], height: 0, width: 0 };
  }
  return {
    glyphs: placed.map((glyph) => ({
      ...glyph,
      x: glyph.x - left,
      y: glyph.y - top,
    })),
    height: bottom - top,
    width: right - left,
  };
};
