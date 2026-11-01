import { describe, expect, it } from "vitest";

import {
  applyMark,
  clearMarkKey,
  markValue,
  normalizeMarks,
  rebaseMarks,
  styledSegments,
} from "@/lib/text/marks";

const RED = "#ff0000";

describe("marks", () => {
  it("cleans overlapping, touching and stray marks up", () => {
    expect(
      normalizeMarks("hello world", [
        { end: 5, fill: RED, start: 0 },
        { end: 7, fill: RED, start: 5 },
        { end: 99, start: 9, weight: 700 },
      ])
    ).toEqual([
      { end: 7, fill: RED, start: 0 },
      { end: 11, start: 9, weight: 700 },
    ]);
  });

  it("sets and clears keys on a range", () => {
    const red = applyMark("hello world", [], 6, 11, { fill: RED });
    expect(red).toEqual([{ end: 11, fill: RED, start: 6 }]);
    const bold = applyMark("hello world", red, 0, 8, { weight: 700 });
    expect(bold).toEqual([
      { end: 6, start: 0, weight: 700 },
      { end: 8, fill: RED, start: 6, weight: 700 },
      { end: 11, fill: RED, start: 8 },
    ]);
    expect(
      applyMark("hello world", bold, 0, 11, { weight: undefined })
    ).toEqual(red);
    expect(clearMarkKey("hello world", bold, "fill")).toEqual([
      { end: 8, start: 0, weight: 700 },
    ]);
  });

  it("keeps marks on their characters as the text changes", () => {
    const marks = [{ end: 11, fill: RED, start: 6 }];
    // Typing before the mark moves it
    expect(rebaseMarks("hello world", "oh hello world", marks)).toEqual([
      { end: 14, fill: RED, start: 9 },
    ]);
    // Typing inside it (or right after it) takes its style
    expect(rebaseMarks("hello world", "hello worlds", marks)).toEqual([
      { end: 12, fill: RED, start: 6 },
    ]);
    // Deleting part of it shrinks it
    expect(rebaseMarks("hello world", "hello wd", marks)).toEqual([
      { end: 8, fill: RED, start: 6 },
    ]);
    // Deleting all of it removes it
    expect(rebaseMarks("hello world", "hello ", marks)).toEqual([]);
  });

  it("cuts the text where its style changes", () => {
    expect(
      styledSegments("hello world", [{ end: 11, fill: RED, start: 6 }])
    ).toEqual([
      { start: 0, style: {}, text: "hello " },
      { start: 6, style: { fill: RED }, text: "world" },
    ]);
    expect(styledSegments("plain", [])).toEqual([
      { start: 0, style: {}, text: "plain" },
    ]);
  });

  it("reads one value across a range, or mixed", () => {
    const marks = [{ end: 11, fill: RED, start: 6 }];
    expect(markValue("hello world", marks, 6, 9, "fill")).toBe(RED);
    expect(markValue("hello world", marks, 4, 9, "fill")).toBe("mixed");
    expect(markValue("hello world", marks, 0, 3, "fill")).toBeUndefined();
  });
});
