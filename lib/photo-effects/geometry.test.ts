import { describe, expect, it } from "vitest";

import { parseHex } from "@/lib/document/color";
import type { Rgba } from "@/lib/document/color";
import type { PhotoEffects } from "@/lib/document/schema";
import {
  DEFAULT_EFFECTS,
  EFFECTS_SUPERSAMPLE,
  GLOW_GAIN,
  PAD_STEP,
  effectsAtSize,
  effectsLayout,
  effectsPaint,
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

const FULL: PhotoEffects = {
  glow: { color: "#ff2e93", size: 20 },
  outline: { color: "#ffffff", width: 10 },
  shadow: { blur: 40, color: "#00000080", offsetX: 30, offsetY: -50 },
};

describe("effectsReach", () => {
  it("counts the outline in every bitmap", () => {
    expect(effectsReach(OUTLINE)).toEqual({ halo: 10, shadow: null });
  });

  it("reaches three sigmas past the outline for glows and shadows", () => {
    // sigma = half the size or blur, as canvas shadows have it
    expect(effectsReach(FULL)).toEqual({ halo: 40, shadow: 70 });
    const glowOnly = { ...NONE, glow: { color: "#fff", size: 20 } };
    expect(effectsReach(glowOnly)).toEqual({ halo: 30, shadow: null });
  });

  it("leaves the shadow's offset to whoever draws it", () => {
    const moved = {
      ...FULL,
      shadow: { blur: 40, color: "#000", offsetX: -400, offsetY: 900 },
    };
    expect(effectsReach(moved)).toEqual(effectsReach(FULL));
    expect(effectsLayout(BOX, moved, 4096)).toEqual(
      effectsLayout(BOX, FULL, 4096)
    );
  });

  it("pads the field for the furthest bitmap, each region for its own", () => {
    const layout = effectsLayout(BOX, FULL, 4096);
    // 70 page px = 140 bitmap px + 2, up to a step of 16
    expect(layout?.pad).toBe(144);
    // Each region: its own reach in bitmap px plus the 2 px edge
    expect(layout?.shadow).toEqual({ height: 1084, width: 884, x: 2, y: 2 });
    expect(layout?.halo).toEqual({ height: 964, width: 764, x: 62, y: 62 });
  });
});

const rgba = (color: string): Rgba => parseHex(color) ?? [0, 0, 0, 0];

describe("effectsPaint", () => {
  it("premultiplies the halo's colours and keeps the shadow's straight", () => {
    const paint = effectsPaint(FULL, 1, 2, rgba);
    expect(paint.outline).toEqual({ color: [1, 1, 1, 1], width: 20 });
    expect(paint.glow?.color[3]).toBe(1);
    expect(paint.glow?.color[0]).toBe(1);
    expect(paint.glow?.color[1]).toBeCloseTo(46 / 255);
    // Sigmas in bitmap px: half the size, twice over at 2×
    expect(paint.glow?.sigma).toBe(20);
    expect(paint.glow?.gain).toBe(GLOW_GAIN);
    expect(paint.shadow?.sigma).toBe(40);
    expect(paint.shadow?.color).toEqual([0, 0, 0, 128 / 255]);
    expect(paint.opacity).toBe(1);
  });

  it("thins a see-through outline's colour by its alpha", () => {
    const paint = effectsPaint(
      { ...NONE, outline: { color: "#ff000080", width: 4 } },
      0.5,
      1,
      rgba
    );
    const alpha = 128 / 255;
    expect(paint.outline?.color).toEqual([alpha, 0, 0, alpha]);
    expect(paint.opacity).toBe(0.5);
  });

  it("paints nothing for effects that are off or zero-sized", () => {
    const paint = effectsPaint(
      {
        glow: { color: "#fff", size: 0 },
        outline: { color: "#fff", width: 0 },
        shadow: null,
      },
      1,
      2,
      rgba
    );
    expect([paint.outline, paint.glow, paint.shadow]).toEqual([
      null,
      null,
      null,
    ]);
  });
});
