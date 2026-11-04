import { describe, expect, it } from "vitest";

import { createTextElement } from "@/lib/document/factories";
import type { TextElement } from "@/lib/document/schema";
import { measureTextElement, textRunsOf } from "@/lib/text/element-layout";
import type { Measurer } from "@/lib/text/layout";

// Every character is half the font size wide; the font box is 0.8 above the
// baseline and 0.2 below it
const measurer: Measurer = {
  fontBox: (style) => ({
    ascent: style.fontSize * 0.8,
    descent: style.fontSize * 0.2,
  }),
  width: (text, style) => [...text].length * style.fontSize * 0.5,
};

const ready = () => true;

const text = (overrides: Partial<TextElement>): TextElement => ({
  ...createTextElement("heading", { height: 720, width: 1280 }),
  fontSize: 20,
  letterSpacingEm: 0,
  lineHeight: 1.5,
  marks: [],
  uppercase: false,
  width: 100,
  ...overrides,
});

describe("text element layout", () => {
  it("cuts the text into runs where its marks change its style", () => {
    const { fonts, runs, strut } = textRunsOf(
      text({
        marks: [{ end: 9, fill: "#ff0000", sizeEm: 2, start: 5 }],
        text: "hello world",
      }),
      ready
    );
    expect(runs.map((run) => run.text)).toEqual(["hello", " wor", "ld"]);
    expect(runs[1]?.style).toMatchObject({ fill: "#ff0000", fontSize: 40 });
    expect(strut.fontSize).toBe(20);
    expect(fonts).toHaveLength(4);
  });

  it("measures straight text at its wrap width, as tall as its lines", () => {
    // 10 characters fit in 100px; each line is 1.5 × 20 tall
    const measured = measureTextElement(
      text({ text: "aaaa bbbb cccc" }),
      measurer,
      ready
    );
    expect(measured).toEqual({
      height: 60,
      inkWidth: 90,
      splitsWords: false,
      width: 100,
    });
  });

  it("says when a word had to break to fit", () => {
    const measured = measureTextElement(
      text({ text: "abcdefghijklmn" }),
      measurer,
      ready
    );
    expect(measured.splitsWords).toBe(true);
    expect(measured.height).toBe(60);
    // A break at a space or a dash isn't one
    expect(
      measureTextElement(text({ text: "abcdefgh-ijk" }), measurer, ready)
        .splitsWords
    ).toBe(false);
  });

  it("measures curved text by its arc", () => {
    const straight = measureTextElement(
      text({ curve: 0, text: "curved" }),
      measurer,
      ready
    );
    const curved = measureTextElement(
      text({ curve: 60, text: "curved" }),
      measurer,
      ready
    );
    // Its own box, not the wrap width, and taller than one straight line
    expect(curved.width).toBe(curved.inkWidth);
    expect(curved.width).not.toBe(straight.width);
    expect(curved.height).toBeGreaterThan(straight.height);
  });
});
