import { describe, expect, it } from "vitest";

import { squareCrop } from "@/lib/upload/prepare-avatar";

describe("squareCrop", () => {
  it("keeps the middle of a landscape image", () => {
    expect(squareCrop(1600, 900)).toEqual({ side: 900, x: 350, y: 0 });
  });

  it("keeps the middle of a portrait image", () => {
    expect(squareCrop(600, 1000)).toEqual({ side: 600, x: 0, y: 200 });
  });

  it("leaves a square image whole", () => {
    expect(squareCrop(512, 512)).toEqual({ side: 512, x: 0, y: 0 });
  });
});
