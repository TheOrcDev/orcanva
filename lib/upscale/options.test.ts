import { describe, expect, it } from "vitest";

import {
  factorLabel,
  looksSoft,
  pixelDensity,
  upscaleOptions,
} from "@/lib/upscale/options";

const LIMITS = { maxPixels: 3840 * 2160, maxSide: 4096 };

describe("upscaleOptions", () => {
  it("offers 2× and 4× for a small photo", () => {
    expect(upscaleOptions({ height: 360, width: 640 }, LIMITS)).toEqual([
      { factor: 2, height: 720, variant: "upscaled-2x", width: 1280 },
      { factor: 4, height: 1440, variant: "upscaled-4x", width: 2560 },
    ]);
  });

  it("caps 4× at the limits", () => {
    const [double, quadruple] = upscaleOptions(
      { height: 720, width: 1280 },
      LIMITS
    );
    expect(double).toMatchObject({ height: 1440, width: 2560 });
    expect(quadruple).toMatchObject({ height: 2160, width: 3840 });
    expect(quadruple?.factor).toBe(3);
  });

  it("keeps the long side within the limit", () => {
    const [, tall] = upscaleOptions({ height: 1500, width: 300 }, LIMITS);
    expect(tall).toMatchObject({ height: 4096, width: 819 });
  });

  it("drops a choice capped to the size of a smaller one", () => {
    const options = upscaleOptions({ height: 1200, width: 1800 }, LIMITS);
    expect(options).toHaveLength(1);
    expect(options[0]?.variant).toBe("upscaled-2x");
    expect(options[0]?.width).toBeLessThanOrEqual(4096);
    expect(
      (options[0]?.width ?? 0) * (options[0]?.height ?? 0)
    ).toBeLessThanOrEqual(3840 * 2160);
  });

  it("offers nothing for a photo already near the limits", () => {
    expect(upscaleOptions({ height: 2000, width: 3600 }, LIMITS)).toEqual([]);
  });
});

describe("factorLabel", () => {
  it("shows whole and capped factors", () => {
    expect(factorLabel(2)).toBe("2×");
    expect(factorLabel(3.2134)).toBe("3.2×");
  });
});

describe("looksSoft", () => {
  it("compares the photo's pixels with its size on the page", () => {
    const photo = { height: 360, width: 640 };
    expect(pixelDensity(photo, { height: 720, width: 1280 }, null)).toBe(0.5);
    expect(looksSoft(photo, { height: 720, width: 1280 }, null)).toBe(true);
    expect(looksSoft(photo, { height: 360, width: 640 }, null)).toBe(false);
  });

  it("counts only the part a crop shows", () => {
    // Half the photo fills a 640px box: 320 photo pixels across 640
    const crop = { height: 1, width: 0.5, x: 0.25, y: 0 };
    expect(
      looksSoft({ height: 360, width: 640 }, { height: 720, width: 640 }, crop)
    ).toBe(true);
  });
});
