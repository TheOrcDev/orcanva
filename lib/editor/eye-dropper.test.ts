import { describe, expect, it } from "vitest";

import { keepAlpha, pickScreenColor } from "@/lib/editor/eye-dropper";

// Stand-ins for the browser's eyedropper
const picks = (sRGBHex: string) => () => Promise.resolve({ sRGBHex });
const pressEscape = () =>
  Promise.reject(new DOMException("Canceled", "AbortError"));
const refuse = () => Promise.reject(new Error("Not allowed"));

describe("eyedropper", () => {
  it("keeps the current colour's transparency", () => {
    expect(keepAlpha("#ff8000", "#00000080")).toBe("#ff800080");
    expect(keepAlpha("#ff8000", "#0008")).toBe("#ff800088");
    expect(keepAlpha("#ff8000", "#123456")).toBe("#ff8000");
    // Something the picker can't read counts as opaque
    expect(keepAlpha("#ff8000", "transparent")).toBe("#ff8000");
  });

  it("normalises what the browser reports", () => {
    expect(keepAlpha("#FF8000", "#000000")).toBe("#ff8000");
    expect(keepAlpha("#f80", "#000000")).toBe("#ff8800");
    expect(keepAlpha(" rgb(255, 128, 0) ", "#00000080")).toBe("#ff800080");
    expect(keepAlpha("rgba(1,2,3,0.5)", "#000000")).toBe("#010203");
    expect(keepAlpha("#ff8000ff", "#000000")).toBe("#ff8000");
    expect(keepAlpha("color(display-p3 1 0 0)", "#000000")).toBeNull();
  });

  it("picks through the browser, and Esc picks nothing", async () => {
    expect(await pickScreenColor("#00000040", picks("#336699"))).toBe(
      "#33669940"
    );
    expect(await pickScreenColor("#000000", pressEscape)).toBeNull();
    await expect(pickScreenColor("#000000", refuse)).rejects.toThrow(
      "Not allowed"
    );
  });
});
