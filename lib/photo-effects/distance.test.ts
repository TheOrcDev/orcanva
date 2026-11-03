import { describe, expect, it } from "vitest";

import {
  outlineCoverage,
  squaredSeedDistances,
} from "@/lib/photo-effects/distance";

// RGBA pixels from rows of alphas
const pixels = (rows: number[][]): Uint8ClampedArray =>
  Uint8ClampedArray.from(rows.flat().flatMap((alpha) => [0, 0, 0, alpha]));

describe("squaredSeedDistances", () => {
  it("measures straight to the nearest pixel covered at least half", () => {
    const distances = squaredSeedDistances(
      pixels([
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 255, 0, 0],
        [0, 0, 0, 0, 0],
        [0, 0, 0, 0, 127],
      ]),
      5,
      5
    );
    // A pixel at 127 isn't a seed; the corner is √8 from the middle
    expect([...distances]).toEqual([
      8, 5, 4, 5, 8, 5, 2, 1, 2, 5, 4, 1, 0, 1, 4, 5, 2, 1, 2, 5, 8, 5, 4, 5, 8,
    ]);
  });

  it("finds the nearer of two seeds across a wide row", () => {
    const row = Array.from({ length: 40 }, (_, x) =>
      x === 3 || x === 30 ? 200 : 0
    );
    const distances = squaredSeedDistances(pixels([row]), 40, 1);
    expect(distances[0]).toBe(9);
    expect(distances[16]).toBe(169);
    expect(distances[17]).toBe(169);
    expect(distances[39]).toBe(81);
  });

  it("leaves pixels far from any seed when there are none", () => {
    const distances = squaredSeedDistances(pixels([[0, 0, 0]]), 3, 1);
    expect(Math.min(...distances)).toBeGreaterThan(1e10);
  });
});

describe("outlineCoverage", () => {
  it("covers the width fully and fades over its last pixel", () => {
    expect(outlineCoverage(0, 4)).toBe(1);
    expect(outlineCoverage(5, 4)).toBe(0);
    expect(outlineCoverage(4.5, 4)).toBeCloseTo(0.5);
    expect(outlineCoverage(1, 0.3)).toBeCloseTo(0.3);
  });
});
