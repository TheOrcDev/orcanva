import { describe, expect, it } from "vitest";

import type { PhotoEffects } from "@/lib/document/schema";
import {
  DEFAULT_EFFECTS,
  EFFECTS_SUPERSAMPLE,
  PAD_STEP,
  effectsAtSize,
  effectsLayout,
  effectsReach,
  floodSteps,
  regionOnPage,
} from "@/lib/photo-effects/geometry";

const NONE: PhotoEffects = { glow: null, outline: null, shadow: null };
const OUTLINE: PhotoEffects = {
  ...NONE,
  outline: { color: "#ffffff", width: 10 },
};
const BOX = { height: 400, width: 300 };

describe("effectsLayout", () => {
  it("draws nothing without an effect that shows", () => {
    expect(effectsLayout(BOX, NONE, 4096)).toBeNull();
    expect(
      effectsLayout(
        BOX,
        { ...NONE, outline: { color: "#fff", width: 0 } },
        4096
      )
    ).toBeNull();
  });

  it("pads the box at twice its size for an outline", () => {
    const layout = effectsLayout(BOX, OUTLINE, 4096);
    expect(layout?.scale).toBe(EFFECTS_SUPERSAMPLE);
    // 10 page px = 20 bitmap px, plus a 2 px edge, in steps of 16
    expect(layout?.pad).toBe(32);
    expect(layout?.size).toEqual({ height: 864, width: 664 });
    // The outline's own region is just big enough
    expect(layout?.halo).toEqual({ height: 844, width: 644, x: 10, y: 10 });
    expect(layout?.shadow).toBeNull();
  });

  it("keeps the padding while a small change stays in its step", () => {
    const thicker = { ...NONE, outline: { color: "#fff", width: 12 } };
    expect(effectsLayout(BOX, thicker, 4096)?.pad).toBe(32);
    expect(effectsLayout(BOX, OUTLINE, 4096)?.pad).toBe(32);
    const thick = { ...NONE, outline: { color: "#fff", width: 20 } };
    expect((effectsLayout(BOX, thick, 4096)?.pad ?? 0) % PAD_STEP).toBe(0);
  });

  it("uses fewer bitmap px per page px rather than pass the size cap", () => {
    const big = { height: 3000, width: 2000 };
    const layout = effectsLayout(big, OUTLINE, 4096);
    expect(layout?.scale).toBeLessThan(2);
    expect(
      Math.max(layout?.size.width ?? 0, layout?.size.height ?? 0)
    ).toBeLessThanOrEqual(4096);
  });

  it("places a region around the box in page px", () => {
    const layout = effectsLayout(BOX, OUTLINE, 4096);
    if (!layout?.halo) {
      throw new Error("expected an outline region");
    }
    expect(regionOnPage(layout, layout.halo)).toEqual({
      height: 422,
      width: 322,
      x: -11,
      y: -11,
    });
  });
});

describe("floodSteps", () => {
  it("reaches the distance, halving down to one, plus one more", () => {
    expect(floodSteps(1)).toEqual([1, 1]);
    expect(floodSteps(3)).toEqual([2, 1, 1]);
    expect(floodSteps(21)).toEqual([16, 8, 4, 2, 1, 1]);
    // s, s/2 … 1 reach 2s - 1
    const steps = floodSteps(100);
    expect(steps.slice(0, -1).reduce((sum, step) => sum + step, 0)).toBe(127);
  });
});

describe("effectsAtSize", () => {
  it("sizes fractions of the photo's shorter side in whole px", () => {
    expect(effectsAtSize(DEFAULT_EFFECTS, BOX)).toEqual({
      glow: { color: "#ffffff", size: 24 },
      outline: { color: "#ffffff", width: 9 },
      shadow: { blur: 15, color: "#00000080", offsetX: 5, offsetY: 9 },
    });
  });

  it("keeps sizes that are on at 1 px or more on tiny photos", () => {
    const tiny = effectsAtSize(DEFAULT_EFFECTS, { height: 10, width: 10 });
    expect(tiny.outline?.width).toBe(1);
    expect(tiny.glow?.size).toBe(1);
  });
});

describe("effectsReach", () => {
  it("counts the outline in every bitmap", () => {
    expect(effectsReach(OUTLINE)).toEqual({ halo: 10, shadow: null });
  });
});
