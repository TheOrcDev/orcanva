import { describe, expect, it } from "vitest";

import { fitScale, thumbnailFit } from "@/lib/youtube-preview/layout";

describe("thumbnailFit", () => {
  it("fills the frame at 16:9", () => {
    const full = { exact: true, height: 1, width: 1, x: 0, y: 0 };
    expect(thumbnailFit({ height: 720, width: 1280 })).toEqual(full);
    expect(thumbnailFit({ height: 2160, width: 3840 })).toEqual(full);
    // A hair off 16:9 still counts
    expect(thumbnailFit({ height: 768, width: 1366 })).toEqual(full);
  });

  it("puts bars above and below a wider picture", () => {
    const fit = thumbnailFit({ height: 1000, width: 3000 });
    expect(fit.exact).toBe(false);
    expect(fit.width).toBe(1);
    expect(fit.x).toBe(0);
    expect(fit.height).toBeCloseTo(16 / 9 / 3);
    expect(fit.y).toBeCloseTo((1 - 16 / 9 / 3) / 2);
  });

  it("puts bars beside a taller picture", () => {
    const square = thumbnailFit({ height: 1080, width: 1080 });
    expect(square.exact).toBe(false);
    expect(square.height).toBe(1);
    expect(square.y).toBe(0);
    expect(square.width).toBeCloseTo(9 / 16);
    expect(square.x).toBeCloseTo(7 / 32);

    const story = thumbnailFit({ height: 1920, width: 1080 });
    expect(story.width).toBeCloseTo((9 / 16) ** 2);
    expect(story.x + story.width / 2).toBeCloseTo(0.5);
  });
});

describe("fitScale", () => {
  it("keeps the real size when there's room", () => {
    expect(fitScale(784, 900)).toBe(1);
    expect(fitScale(784, 784)).toBe(1);
  });

  it("shrinks to fit, rounded down", () => {
    expect(fitScale(800, 640)).toBe(0.8);
    expect(fitScale(784, 600)).toBe(0.76);
    expect(784 * fitScale(784, 600)).toBeLessThanOrEqual(600);
  });

  it("waits for a width to fit", () => {
    expect(fitScale(784, 0)).toBe(1);
    expect(fitScale(0, 500)).toBe(1);
    expect(fitScale(784, Number.NaN)).toBe(1);
  });
});
