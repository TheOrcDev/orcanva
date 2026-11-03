import { describe, expect, it } from "vitest";

import {
  alphaAsGrey,
  bleedEdges,
  encodeOptions,
  hasTransparency,
  restoreAlpha,
} from "@/lib/upscale/encode";

const pixels = (...values: number[][]) => new Uint8ClampedArray(values.flat());

describe("hasTransparency", () => {
  it("finds any pixel that isn't fully opaque", () => {
    expect(hasTransparency(pixels([1, 2, 3, 255], [4, 5, 6, 255]))).toBe(false);
    expect(hasTransparency(pixels([1, 2, 3, 255], [4, 5, 6, 254]))).toBe(true);
  });
});

describe("encodeOptions", () => {
  it("keeps transparency in a PNG and saves opaque photos as JPEG", () => {
    expect(encodeOptions(true)).toEqual({ type: "image/png" });
    expect(encodeOptions(false)).toEqual({
      quality: 0.92,
      type: "image/jpeg",
    });
  });
});

describe("bleedEdges", () => {
  it("fills transparent pixels with the nearest visible colour", () => {
    // A row: red, clear, clear, clear, blue at half opacity
    const row = pixels(
      [255, 0, 0, 255],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 255, 128]
    );
    bleedEdges(row, 5, 1);
    expect([...row]).toEqual(
      [
        [255, 0, 0, 255],
        [255, 0, 0, 0],
        [255, 0, 0, 0],
        [0, 0, 255, 0],
        [0, 0, 255, 128],
      ].flat()
    );
  });

  it("reaches across rows", () => {
    // 2 × 2 with only the bottom-right pixel visible
    const square = pixels(
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [9, 8, 7, 255]
    );
    bleedEdges(square, 2, 2);
    for (let pixel = 0; pixel < 3; pixel += 1) {
      expect(square.slice(pixel * 4, pixel * 4 + 4)).toEqual(
        pixels([9, 8, 7, 0])
      );
    }
  });

  it("leaves an image with nothing visible alone", () => {
    const clear = pixels([1, 2, 3, 0]);
    bleedEdges(clear, 1, 1);
    expect([...clear]).toEqual([1, 2, 3, 0]);
  });
});

describe("alpha through the model", () => {
  it("goes out as grey and comes back as alpha", () => {
    const source = pixels([10, 20, 30, 0], [40, 50, 60, 200]);
    const grey = alphaAsGrey(source);
    expect([...grey]).toEqual([0, 0, 0, 255, 200, 200, 200, 255]);
    const upscaled = pixels([10, 20, 30, 255], [40, 50, 60, 255]);
    restoreAlpha(upscaled, pixels([2, 0, 1, 255], [199, 201, 200, 255]));
    expect([...upscaled]).toEqual([10, 20, 30, 1, 40, 50, 60, 200]);
  });
});
