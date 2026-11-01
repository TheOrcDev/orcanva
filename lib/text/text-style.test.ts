import { describe, expect, it } from "vitest";

import { createTextElement } from "@/lib/document/factories";
import {
  styleText,
  styleValue,
  toggleBold,
  toggleStyle,
} from "@/lib/text/text-style";

const PAGE = { height: 720, width: 1280 };
const base = {
  ...createTextElement("body", PAGE),
  fill: "#111111",
  text: "hello world",
  weight: 400,
};

describe("text styles", () => {
  it("styles the selected characters with a mark", () => {
    expect(styleText(base, { end: 11, start: 6 }, "fill", "#ff0000")).toEqual({
      marks: [{ end: 11, fill: "#ff0000", start: 6 }],
    });
  });

  it("styles the whole text when nothing is selected, dropping marks of that key", () => {
    const marked = {
      ...base,
      marks: [{ end: 11, fill: "#ff0000", start: 6, weight: 700 }],
    };
    expect(styleText(marked, null, "fill", "#00ff00")).toEqual({
      fill: "#00ff00",
      marks: [{ end: 11, start: 6, weight: 700 }],
    });
    expect(styleText(marked, { end: 3, start: 3 }, "sizeEm", 2)).toMatchObject({
      fontSize: base.fontSize * 2,
    });
  });

  it("needs no mark for the text's own value", () => {
    const marked = { ...base, marks: [{ end: 11, fill: "#ff0000", start: 6 }] };
    expect(styleText(marked, { end: 11, start: 6 }, "fill", "#111111")).toEqual(
      { marks: [] }
    );
  });

  it("reads values across a selection", () => {
    const marked = { ...base, marks: [{ end: 11, start: 6, weight: 700 }] };
    expect(styleValue(marked, { end: 9, start: 6 }, "weight")).toBe(700);
    expect(styleValue(marked, { end: 9, start: 0 }, "weight")).toBe("mixed");
    expect(styleValue(marked, null, "weight")).toBe(400);
  });

  it("toggles bold and underline on unless all of it has them", () => {
    expect(toggleBold(base, { end: 5, start: 0 })).toEqual({
      marks: [{ end: 5, start: 0, weight: 700 }],
    });
    const bold = { ...base, marks: [{ end: 5, start: 0, weight: 700 }] };
    expect(toggleBold(bold, { end: 5, start: 0 })).toEqual({ marks: [] });
    expect(toggleStyle(base, null, "underline")).toEqual({
      marks: [],
      underline: true,
    });
  });
});
