import { describe, expect, it } from "vitest";

import {
  hasAdjustments,
  withAdjustment,
  withPreset,
  withStrength,
  withoutAdjustments,
} from "@/lib/image-filters/edit";

describe("editing a filter", () => {
  it("creates a filter from the first slider move", () => {
    const filter = withAdjustment(null, "contrast", 30);
    expect(filter).toMatchObject({ preset: null, strength: 100 });
    expect(filter?.adjust).toMatchObject({ brightness: 0, contrast: 30 });
    expect(hasAdjustments(filter)).toBe(true);
  });

  it("goes back to no filter when every slider returns to zero", () => {
    const filter = withAdjustment(null, "contrast", 30);
    expect(withAdjustment(filter, "contrast", 0)).toBeNull();
  });

  it("keeps a preset when the sliders reset", () => {
    const filter = withAdjustment(withPreset(null, "ash"), "warmth", 20);
    const reset = withoutAdjustments(filter);
    expect(reset).toMatchObject({ preset: "ash" });
    expect(hasAdjustments(reset)).toBe(false);
    expect(withoutAdjustments(withAdjustment(null, "fade", 10))).toBeNull();
  });

  it("starts a newly picked preset at full intensity", () => {
    const filter = withStrength(withPreset(null, "ash"), 40);
    expect(withPreset(filter, "mist")).toMatchObject({
      preset: "mist",
      strength: 100,
    });
  });

  it("keeps manual sliders when going back to Original", () => {
    const filter = withAdjustment(withPreset(null, "ash"), "warmth", 20);
    expect(withPreset(filter, null)).toMatchObject({
      adjust: { warmth: 20 },
      preset: null,
    });
    expect(withPreset(withPreset(null, "ash"), null)).toBeNull();
  });

  it("changes intensity only on an existing filter", () => {
    expect(withStrength(null, 50)).toBeNull();
    expect(withStrength(withPreset(null, "ash"), 50)).toMatchObject({
      strength: 50,
    });
  });
});
