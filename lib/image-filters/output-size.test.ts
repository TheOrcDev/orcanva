import { describe, expect, it } from "vitest";

import { filterOutputSize } from "@/lib/image-filters/output-size";

describe("filterOutputSize", () => {
  it("never upscales past the photo's own pixels", () => {
    expect(
      filterOutputSize({ height: 600, width: 800 }, { height: 720, width: 960 })
    ).toEqual({ height: 600, width: 800 });
  });

  it("keeps twice the element's page size for retina and 2x exports", () => {
    expect(
      filterOutputSize(
        { height: 3000, width: 4000 },
        { height: 300, width: 400 }
      )
    ).toEqual({ height: 600, width: 800 });
  });

  it("follows the stretched axis when the element isn't the photo's ratio", () => {
    expect(
      filterOutputSize(
        { height: 2000, width: 2000 },
        { height: 100, width: 500 }
      )
    ).toEqual({ height: 1000, width: 1000 });
  });

  it("respects the GPU's size limit", () => {
    expect(
      filterOutputSize(
        { height: 4000, width: 4000 },
        { height: 4000, width: 4000 },
        2048
      )
    ).toEqual({ height: 2048, width: 2048 });
  });
});
