import { describe, expect, it } from "vitest";

import { assetToLocal, localToAsset } from "@/lib/magic-eraser/geometry";
import type { PhotoPlacement } from "@/lib/magic-eraser/geometry";

// A 1000 × 500 photo cropped to its middle half across and its bottom
// half, shown in a 200 × 100 box
const CROPPED: PhotoPlacement = {
  box: { height: 100, width: 200 },
  crop: { height: 0.5, width: 0.5, x: 0.25, y: 0.5 },
  flipX: false,
  flipY: false,
  photo: { height: 500, width: 1000 },
};

// Maps a photo pixel into the box through assetToLocal's transform
const toLocal = (
  placement: PhotoPlacement,
  point: { x: number; y: number }
) => {
  const { scaleX, scaleY, x, y } = assetToLocal(placement);
  return { x: x + point.x * scaleX, y: y + point.y * scaleY };
};

describe("localToAsset", () => {
  it("maps the box's corners to the crop's corners", () => {
    expect(localToAsset({ x: 0, y: 0 }, CROPPED)).toEqual({ x: 250, y: 250 });
    expect(localToAsset({ x: 200, y: 100 }, CROPPED)).toEqual({
      x: 750,
      y: 500,
    });
  });

  it("is the whole photo without a crop", () => {
    expect(localToAsset({ x: 50, y: 25 }, { ...CROPPED, crop: null })).toEqual({
      x: 250,
      y: 125,
    });
  });

  it("mirrors with the flips, so the left of the box is the photo's right", () => {
    const flipped = { ...CROPPED, flipX: true, flipY: true };
    expect(localToAsset({ x: 0, y: 0 }, flipped)).toEqual({ x: 750, y: 500 });
    expect(localToAsset({ x: 50, y: 25 }, flipped)).toEqual({
      x: 625,
      y: 437.5,
    });
  });
});

describe("assetToLocal", () => {
  it("undoes localToAsset for every crop and flip", () => {
    for (const flipX of [false, true]) {
      for (const flipY of [false, true]) {
        const placement = { ...CROPPED, flipX, flipY };
        for (const point of [
          { x: 0, y: 0 },
          { x: 37, y: 81 },
          { x: 200, y: 100 },
        ]) {
          const back = toLocal(placement, localToAsset(point, placement));
          expect(back.x).toBeCloseTo(point.x);
          expect(back.y).toBeCloseTo(point.y);
        }
      }
    }
  });

  it("scales by box pixels per photo pixel", () => {
    // 200 box pixels show 500 photo pixels
    expect(assetToLocal(CROPPED)).toEqual({
      scaleX: 0.4,
      scaleY: 0.4,
      x: -100,
      y: -100,
    });
  });
});
