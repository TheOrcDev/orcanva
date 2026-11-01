import { describe, expect, it } from "vitest";

import { layoutText } from "@/lib/text/layout";
import type { Measurer, TextStyle } from "@/lib/text/layout";

// Every character is half the font size wide; the font box is 0.8 above the
// baseline and 0.2 below it
const measure: Measurer = {
  fontBox: (style) => ({
    ascent: style.fontSize * 0.8,
    descent: style.fontSize * 0.2,
  }),
  width: (text, style) => [...text].length * style.fontSize * 0.5,
};

const style = (fontSize = 20, letterSpacing = 0): TextStyle => ({
  font: `400 normal ${fontSize}px "Test"`,
  fontSize,
  letterSpacing,
});

const lineTexts = (layout: ReturnType<typeof layoutText>) =>
  layout.lines.map((line) => line.pieces.map((piece) => piece.text).join(""));

const options = { align: "left" as const, lineHeight: 1.5, width: 100 };

describe("layoutText", () => {
  it("keeps a paragraph that fits on one line, spaces and all", () => {
    const layout = layoutText(
      [{ style: style(), text: "fits " }],
      options,
      measure
    );
    expect(lineTexts(layout)).toEqual(["fits "]);
    expect(layout.textWidth).toBe(50);
    expect(layout.height).toBe(30);
  });

  it("wraps after the last space or dash that fits, dropping the spaces", () => {
    // 10 characters fit in 100px
    const layout = layoutText(
      [{ style: style(), text: "one two-three four" }],
      options,
      measure
    );
    expect(lineTexts(layout)).toEqual(["one two-", "three four"]);
  });

  it("splits a word only when nothing else fits", () => {
    const layout = layoutText(
      [{ style: style(), text: "abcdefghijklmno" }],
      options,
      measure
    );
    expect(lineTexts(layout)).toEqual(["abcdefghij", "klmno"]);
  });

  it("starts a line for every newline, empty ones included", () => {
    const layout = layoutText(
      [{ style: style(), text: "a\n\nb" }],
      options,
      measure
    );
    expect(lineTexts(layout)).toEqual(["a", "", "b"]);
    expect(layout.lines.map((line) => line.offset)).toEqual([0, 2, 3]);
    expect(layout.height).toBe(90);
  });

  it("counts letter spacing once per character", () => {
    const layout = layoutText(
      [{ style: style(20, 2), text: "abc" }],
      options,
      measure
    );
    expect(layout.lines[0]?.width).toBe(36);
  });

  it("aligns lines inside the width", () => {
    const right = layoutText(
      [{ style: style(), text: "ab" }],
      { ...options, align: "right" },
      measure
    );
    const center = layoutText(
      [{ style: style(), text: "ab" }],
      { ...options, align: "center" },
      measure
    );
    expect(right.lines[0]?.x).toBe(80);
    expect(center.lines[0]?.x).toBe(40);
  });

  it("places the baseline like Konva: centred by the font box", () => {
    const layout = layoutText(
      [{ style: style(), text: "a\nb" }],
      options,
      measure
    );
    // (16 - 4) / 2 + 30 / 2 = 21, then one line height further down
    expect(layout.lines.map((line) => line.baseline)).toEqual([21, 51]);
  });

  it("mixes styles on a line: one piece per run, as tall as the biggest", () => {
    const layout = layoutText(
      [
        { style: style(20), text: "ab " },
        { style: style(40), text: "CD" },
      ],
      { ...options, width: null },
      measure
    );
    const [line] = layout.lines;
    expect(
      line?.pieces.map((piece) => [piece.text, piece.x, piece.offset])
    ).toEqual([
      ["ab ", 0, 0],
      ["CD", 30, 3],
    ]);
    expect(line?.height).toBe(60);
    expect(line?.width).toBe(70);
  });

  it("wraps across runs", () => {
    const layout = layoutText(
      [
        { style: style(20), text: "aaaa " },
        { style: style(20, 0), text: "bbbb cc" },
      ],
      options,
      measure
    );
    expect(lineTexts(layout)).toEqual(["aaaa bbbb", "cc"]);
  });
});
