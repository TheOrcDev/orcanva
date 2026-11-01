import { describe, expect, it } from "vitest";

import { aspectRatio } from "@/lib/seo/aspect-ratio";

describe("aspectRatio", () => {
  it("reduces to small whole numbers", () => {
    expect(aspectRatio(1280, 720)).toBe("16:9");
    expect(aspectRatio(3840, 2160)).toBe("16:9");
    expect(aspectRatio(1080, 1350)).toBe("4:5");
    expect(aspectRatio(1080, 1920)).toBe("9:16");
    expect(aspectRatio(1080, 1080)).toBe("1:1");
    expect(aspectRatio(1584, 396)).toBe("4:1");
  });

  it("falls back to a decimal when the terms get large", () => {
    expect(aspectRatio(1200, 630)).toBe("1.9:1");
    expect(aspectRatio(1000, 333)).toBe("3:1");
  });
});
