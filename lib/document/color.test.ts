import { describe, expect, it } from "vitest";

import { formatHex, mixRgba, parseHex } from "@/lib/document/color";

describe("hex colours", () => {
  it("reads every hex form the pickers write", () => {
    expect(parseHex("#ff8000")).toEqual([255, 128, 0, 255]);
    expect(parseHex("#f80")).toEqual([255, 136, 0, 255]);
    expect(parseHex("#f808")).toEqual([255, 136, 0, 136]);
    expect(parseHex("#ff800080")).toEqual([255, 128, 0, 128]);
    expect(parseHex("red")).toBeNull();
    expect(parseHex("#ff80")).not.toBeNull();
    expect(parseHex("#ff800")).toBeNull();
  });

  it("writes alpha only when it's see-through", () => {
    expect(formatHex([255, 128, 0, 255])).toBe("#ff8000");
    expect(formatHex([255, 127.6, -3, 128])).toBe("#ff800080");
  });

  it("mixes channel by channel", () => {
    expect(mixRgba([0, 0, 0, 255], [255, 255, 255, 255], 0.25)).toEqual([
      63.75, 63.75, 63.75, 255,
    ]);
  });
});
