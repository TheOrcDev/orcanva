import { describe, expect, it } from "vitest";

import { applyMask, snapAlpha, toRgb } from "@/lib/background-removal/compose";

describe("applyMask", () => {
  it("uses the mask as alpha without touching color", () => {
    const rgba = new Uint8Array([10, 20, 30, 255, 40, 50, 60, 255]);
    expect([...applyMask(rgba, [0, 200])]).toEqual([
      10, 20, 30, 0, 40, 50, 60, 200,
    ]);
  });

  it("keeps pixels that were already transparent transparent", () => {
    const rgba = new Uint8Array([1, 2, 3, 0, 4, 5, 6, 100]);
    expect([...applyMask(rgba, [255, 255])]).toEqual([
      1, 2, 3, 0, 4, 5, 6, 100,
    ]);
  });

  it("rejects a mask that doesn't match the image", () => {
    expect(() => applyMask(new Uint8Array(8), [1, 2, 3])).toThrow(
      "Mask has 3 values"
    );
  });

  it("snaps a near-solid subject to fully opaque", () => {
    const rgba = new Uint8Array([9, 9, 9, 255, 9, 9, 9, 255]);
    expect([...applyMask(rgba, [254, 2])]).toEqual([9, 9, 9, 255, 9, 9, 9, 0]);
  });

  it("does not mutate the input", () => {
    const rgba = new Uint8Array([1, 2, 3, 255]);
    applyMask(rgba, [0]);
    expect(rgba[3]).toBe(255);
  });
});

describe("snapAlpha", () => {
  it("makes near-certain pixels fully opaque or fully clear", () => {
    expect(snapAlpha(254)).toBe(255);
    expect(snapAlpha(250)).toBe(255);
    expect(snapAlpha(3)).toBe(0);
  });

  it("keeps soft edge values", () => {
    expect(snapAlpha(128)).toBe(128);
    expect(snapAlpha(240)).toBe(240);
    expect(snapAlpha(10)).toBe(10);
  });
});

describe("toRgb", () => {
  it("drops the alpha channel", () => {
    expect([...toRgb(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]))]).toEqual([
      1, 2, 3, 5, 6, 7,
    ]);
  });
});
