import { describe, expect, it } from "vitest";

import {
  photoGlowSchema,
  photoOutlineSchema,
  photoShadowSchema,
} from "@/lib/document/schema";
import { scalePhotoEffects } from "@/lib/photo-effects/geometry";
import {
  PHOTO_EFFECT_PRESETS,
  matchingPreset,
  presetEffects,
} from "@/lib/photo-effects/presets";

const BOX = { height: 400, width: 300 };

const preset = (id: string) => {
  const found = PHOTO_EFFECT_PRESETS.find((item) => item.id === id);
  if (!found) {
    throw new Error(`no ${id} preset`);
  }
  return found;
};

describe("presetEffects", () => {
  it("sizes a preset from the photo's shorter side", () => {
    expect(presetEffects(preset("sticker"), BOX)).toEqual({
      glow: null,
      outline: { color: "#ffffff", width: 11 },
      shadow: { blur: 12, color: "#00000066", offsetX: 0, offsetY: 6 },
    });
    // The same look on a photo twice the size is twice as thick
    expect(
      presetEffects(preset("sticker"), { height: 800, width: 600 }).outline
    ).toEqual({ color: "#ffffff", width: 21 });
    expect(presetEffects(preset("none"), BOX)).toEqual({
      glow: null,
      outline: null,
      shadow: null,
    });
  });

  it("stays within the schema's limits on any photo", () => {
    for (const side of [4, 300, 100_000]) {
      for (const item of PHOTO_EFFECT_PRESETS) {
        const { glow, outline, shadow } = presetEffects(item, {
          height: side,
          width: side,
        });
        expect(() => glow && photoGlowSchema.parse(glow)).not.toThrow();
        expect(
          () => outline && photoOutlineSchema.parse(outline)
        ).not.toThrow();
        expect(() => shadow && photoShadowSchema.parse(shadow)).not.toThrow();
      }
    }
  });
});

describe("matchingPreset", () => {
  it("knows each preset it applied", () => {
    for (const item of PHOTO_EFFECT_PRESETS) {
      expect(matchingPreset(presetEffects(item, BOX), BOX)?.id).toBe(item.id);
    }
  });

  it("still knows it once the photo has been scaled", () => {
    const applied = presetEffects(preset("neon"), BOX);
    const scaled = scalePhotoEffects(applied, 2.7);
    expect(
      matchingPreset(scaled, { height: 400 * 2.7, width: 300 * 2.7 })?.id
    ).toBe("neon");
  });

  it("knows none once a colour or a size changed", () => {
    const applied = presetEffects(preset("outline"), BOX);
    const recoloured = {
      ...applied,
      outline: { color: "#000000", width: applied.outline?.width ?? 0 },
    };
    expect(matchingPreset(recoloured, BOX)).toBeUndefined();
    const thicker = {
      ...applied,
      outline: { color: "#ffffff", width: 40 },
    };
    expect(matchingPreset(thicker, BOX)).toBeUndefined();
  });
});
