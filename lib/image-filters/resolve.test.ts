import { describe, expect, it } from "vitest";

import { imageAdjustmentsSchema } from "@/lib/document/schema";
import type { ImageFilter } from "@/lib/document/schema";
import {
  ADJUSTMENTS,
  ADJUSTMENT_ORDER,
  NEUTRAL_ADJUSTMENTS,
} from "@/lib/image-filters/adjustments";
import { FILTER_PRESETS, findPreset } from "@/lib/image-filters/presets";
import {
  hexToRgb,
  resolveFilter,
  toUniforms,
} from "@/lib/image-filters/resolve";

const filter = (patch: Partial<ImageFilter> = {}): ImageFilter => ({
  adjust: { ...NEUTRAL_ADJUSTMENTS },
  preset: null,
  strength: 100,
  ...patch,
});

describe("adjustment catalog", () => {
  it("lists every adjustment the schema stores, once", () => {
    const keys = Object.keys(imageAdjustmentsSchema.shape).toSorted();
    expect([...ADJUSTMENT_ORDER].toSorted()).toEqual(keys);
    expect(Object.keys(ADJUSTMENTS).toSorted()).toEqual(keys);
  });
});

describe("filter presets", () => {
  it("have unique ids and in-range values", () => {
    const ids = FILTER_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const preset of FILTER_PRESETS) {
      expect(() => imageAdjustmentsSchema.parse(preset.adjust)).not.toThrow();
      if (preset.tone) {
        expect(hexToRgb(preset.tone.shadows)).not.toEqual([0.5, 0.5, 0.5]);
        expect(hexToRgb(preset.tone.highlights)).not.toEqual([0.5, 0.5, 0.5]);
        expect(preset.tone.amount).toBeGreaterThan(0);
        expect(preset.tone.amount).toBeLessThanOrEqual(100);
      }
    }
  });

  it("each change the picture at full intensity", () => {
    for (const preset of FILTER_PRESETS) {
      expect(resolveFilter(filter({ preset: preset.id }))).not.toBeNull();
    }
  });
});

describe("resolveFilter", () => {
  it("is null for untouched and neutral filters", () => {
    expect(resolveFilter(null)).toBeNull();
    expect(resolveFilter(filter())).toBeNull();
    expect(resolveFilter(filter({ preset: "forge", strength: 0 }))).toBeNull();
  });

  it("scales the preset by its intensity and adds manual sliders on top", () => {
    const forge = findPreset("forge");
    const resolved = resolveFilter(
      filter({
        adjust: { ...NEUTRAL_ADJUSTMENTS, brightness: 10, contrast: 5 },
        preset: "forge",
        strength: 50,
      })
    );
    expect(resolved?.adjust.contrast).toBe(
      (forge?.adjust.contrast ?? 0) / 2 + 5
    );
    expect(resolved?.adjust.brightness).toBe(10);
    expect(resolved?.adjust.blur).toBe(0);
  });

  it("clamps the sum to each slider's range", () => {
    const resolved = resolveFilter(
      filter({
        adjust: { ...NEUTRAL_ADJUSTMENTS, saturation: -100, vignette: 100 },
        preset: "dusk",
      })
    );
    expect(resolved?.adjust.saturation).toBe(-100);
    expect(resolved?.adjust.vignette).toBe(100);
  });

  it("scales split toning with the intensity", () => {
    const dusk = findPreset("dusk");
    const resolved = resolveFilter(filter({ preset: "dusk", strength: 40 }));
    expect(resolved?.tone?.amount).toBeCloseTo((dusk?.tone?.amount ?? 0) * 0.4);
    expect(resolved?.tone?.shadows).toBe(dusk?.tone?.shadows);
  });

  it("ignores presets this version doesn't know", () => {
    expect(resolveFilter(filter({ preset: "from-the-future" }))).toBeNull();
  });
});

describe("toUniforms", () => {
  it("leaves the picture alone at neutral settings", () => {
    const uniforms = toUniforms({ adjust: NEUTRAL_ADJUSTMENTS, tone: null });
    expect(uniforms).toMatchObject({
      blur: 0,
      brightnessGamma: 1,
      contrast: 1,
      fadeLift: 0,
      fadeScale: 1,
      gains: [1, 1, 1],
      grain: 0,
      highlightsGamma: 1,
      saturation: 1,
      shadowsGamma: 1,
      sharpen: 0,
      toneAmount: 0,
      vignette: 0,
    });
  });

  it("maps slider directions to the right side of neutral", () => {
    const uniforms = toUniforms({
      adjust: {
        ...NEUTRAL_ADJUSTMENTS,
        brightness: 50,
        contrast: -50,
        highlights: -50,
        saturation: -100,
        shadows: 50,
        warmth: 50,
      },
      tone: null,
    });
    // Brighter midtones and lifted shadows use gammas below 1
    expect(uniforms.brightnessGamma).toBeLessThan(1);
    expect(uniforms.shadowsGamma).toBeLessThan(1);
    // Recovered highlights: 1 - (1 - L)^g with g < 1 pulls them down
    expect(uniforms.highlightsGamma).toBeLessThan(1);
    expect(uniforms.contrast).toBeLessThan(1);
    expect(uniforms.saturation).toBe(0);
    const [red, , blue] = uniforms.gains;
    expect(red).toBeGreaterThan(1);
    expect(blue).toBeLessThan(1);
  });

  it("reads tone colours as 0–1 channels", () => {
    expect(hexToRgb("#ff8000")).toEqual([1, 128 / 255, 0]);
    expect(hexToRgb("nope")).toEqual([0.5, 0.5, 0.5]);
  });
});
