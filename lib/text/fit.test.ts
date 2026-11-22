import { describe, expect, it } from "vitest";

import { createTextElement } from "@/lib/document/factories";
import { bakeTextTransform } from "@/lib/editor/bake";
import {
  estimateAutoWidth,
  fittedTextPatch,
  fitTextElement,
  sizeNewText,
} from "@/lib/text/fit";
import type { Measurer } from "@/lib/text/layout";

const PAGE = { height: 720, width: 1280 };

const measurer: Measurer = {
  fontBox: (style) => ({
    ascent: style.fontSize * 0.8,
    descent: style.fontSize * 0.2,
  }),
  width: (text, style) => [...text].length * style.fontSize * 0.5,
};

const ready = () => true;

describe("auto-width text", () => {
  it("creates text that hugs its glyphs instead of the page", () => {
    const heading = createTextElement("heading", PAGE);
    expect(heading.autoWidth).toBe(true);
    expect(heading.width).toBe(estimateAutoWidth(heading));
    expect(heading.width).toBeLessThan(PAGE.width * 0.8);
    expect(heading.x).toBeCloseTo((PAGE.width - heading.width) / 2);
  });

  it("keeps a wrap box when the user sets a width", () => {
    const heading = createTextElement("heading", PAGE);
    const patch = fittedTextPatch(heading, { width: 400 }, measurer, ready);
    expect(patch).toMatchObject({ autoWidth: false, width: 400 });
  });

  it("refits when the text, font, size, spacing or weight changes", () => {
    const heading = {
      ...createTextElement("heading", PAGE),
      fontSize: 20,
      text: "Hi",
      uppercase: false,
      width: 200,
      x: 100,
    };
    const wider = fittedTextPatch(
      heading,
      { text: "Hello there" },
      measurer,
      ready
    );
    // 11 glyphs × 10px, centred so both sides move
    expect(wider.width).toBe(110);
    expect(wider.x).toBe(145);

    const bigger = fittedTextPatch(
      { ...heading, ...wider, text: "Hello there" },
      { fontSize: 40 },
      measurer,
      ready
    );
    expect(bigger.width).toBe(220);

    const spaced = fittedTextPatch(
      heading,
      { letterSpacingEm: 0.5, text: "Hi" },
      measurer,
      ready
    );
    // 2 glyphs × (10 + 10) of letter-spacing
    expect(spaced.width).toBe(40);

    const bold = fittedTextPatch(heading, { weight: 700 }, measurer, ready);
    expect(bold.width).toBe(20);
  });

  it("leaves explicit wrap boxes alone when the type changes", () => {
    const wrapped = {
      ...createTextElement("heading", PAGE),
      autoWidth: false,
      fontSize: 20,
      text: "Hi",
      uppercase: false,
      width: 400,
      x: 50,
    };
    expect(
      fittedTextPatch(wrapped, { fontSize: 40, text: "Hello" }, measurer, ready)
    ).toEqual({ fontSize: 40, text: "Hello" });
  });

  it("side handles turn auto width off; corner scaling keeps it", () => {
    const text = {
      ...createTextElement("heading", PAGE),
      autoWidth: true,
      fontSize: 100,
      width: 200,
    };
    const corner = bakeTextTransform(
      text,
      { rotation: 0, scaleX: 2, scaleY: 2, x: 0, y: 0 },
      text.width
    );
    expect(corner.autoWidth).toBe(true);
    expect(corner.fontSize).toBe(200);
    expect(corner.width).toBe(400);

    const side = bakeTextTransform(
      text,
      { rotation: 0, scaleX: 1, scaleY: 1, x: 5, y: 0 },
      321
    );
    expect(side.autoWidth).toBe(false);
    expect(side.fontSize).toBe(100);
    expect(side.width).toBe(321);
  });

  it("sizes new text from a measurer when one is passed through sizeNewText", () => {
    const draft = {
      ...createTextElement("heading", PAGE),
      fontSize: 20,
      text: "ABCD",
      uppercase: false,
      width: 1,
      x: 0,
    };
    const fitted = fitTextElement(draft, measurer, ready);
    expect(fitted.width).toBe(40);
    expect(sizeNewText(draft).width).toBeGreaterThan(1);
  });
});
