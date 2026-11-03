import { describe, expect, it } from "vitest";

import {
  MAX_TITLE,
  clampTitle,
  normalizeDuration,
} from "@/lib/youtube-preview/details";

describe("normalizeDuration", () => {
  it("writes lengths the way the badge does", () => {
    expect(normalizeDuration("12:34")).toBe("12:34");
    expect(normalizeDuration(" 05:07 ")).toBe("5:07");
    expect(normalizeDuration("0:45")).toBe("0:45");
    expect(normalizeDuration("1:02:03")).toBe("1:02:03");
    expect(normalizeDuration("01:02:03")).toBe("1:02:03");
  });

  it("reads minutes alone, and rolls long minutes into hours", () => {
    expect(normalizeDuration("8")).toBe("8:00");
    expect(normalizeDuration("75:00")).toBe("1:15:00");
    expect(normalizeDuration("90")).toBe("1:30:00");
  });

  it("refuses what isn't a length", () => {
    for (const input of [
      "",
      "abc",
      "12:3",
      "1:75",
      "1:60:00",
      "1:02:03:04",
      "-1:00",
      "12.34",
      "100:00:00",
    ]) {
      expect(normalizeDuration(input)).toBeNull();
    }
    expect(normalizeDuration("99:59:59")).toBe("99:59:59");
  });
});

describe("clampTitle", () => {
  it("keeps titles within the limit as they are", () => {
    expect(clampTitle("")).toBe("");
    expect(clampTitle("My video ")).toBe("My video ");
    const full = "a".repeat(MAX_TITLE);
    expect(clampTitle(full)).toBe(full);
  });

  it("cuts longer titles", () => {
    expect(clampTitle("b".repeat(MAX_TITLE + 20))).toBe("b".repeat(MAX_TITLE));
  });

  it("doesn't leave half an emoji", () => {
    // The 100th code unit is the first half of the orc
    const title = `${"c".repeat(MAX_TITLE - 1)}👹 more`;
    expect(clampTitle(title)).toBe("c".repeat(MAX_TITLE - 1));
    const fits = `${"c".repeat(MAX_TITLE - 2)}👹`;
    expect(clampTitle(`${fits}!`)).toBe(fits);
  });
});
