import { describe, expect, it } from "vitest";

import {
  defaultEffect,
  deviceShadow,
  paintWithEffect,
} from "@/lib/text/effects";

const PAINT = { fill: "#111111", stroke: null, strokeWidth: 0 };

// The shadow each draw happens under, as a canvas would apply it
const shadowsDrawn = (
  kind: "neon" | "lift",
  scale: { x: number; y: number }
) => {
  const context = {
    restore: () => null,
    save: () => null,
    shadowBlur: 0,
    shadowColor: "",
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  };
  const drawn: { blur: number; offsetY: number }[] = [];
  paintWithEffect({
    context: context as unknown as CanvasRenderingContext2D,
    deviceScale: scale,
    draw: () =>
      drawn.push({ blur: context.shadowBlur, offsetY: context.shadowOffsetY }),
    effect: defaultEffect(kind),
    fontSize: 100,
    paint: PAINT,
  });
  return drawn[0];
};

describe("deviceShadow", () => {
  it("scales page units to device pixels like Konva's shadows", () => {
    expect(
      deviceShadow({ blur: 10, offsetX: 4, offsetY: 6 }, { x: 2, y: 2 })
    ).toEqual({ blur: 20, offsetX: 8, offsetY: 12 });
  });

  it("blurs by the smaller scale and keeps a flip's direction", () => {
    expect(
      deviceShadow({ blur: 10, offsetX: 4, offsetY: 6 }, { x: -3, y: 1.5 })
    ).toEqual({ blur: 15, offsetX: -12, offsetY: 9 });
  });
});

describe("paintWithEffect", () => {
  it("grows neon's glow with zoom, so it keeps its size on the page", () => {
    const zoomedOut = shadowsDrawn("neon", { x: 0.5, y: 0.5 });
    const export2x = shadowsDrawn("neon", { x: 2, y: 2 });
    expect(zoomedOut?.blur).toBeGreaterThan(0);
    expect(export2x?.blur).toBeCloseTo((zoomedOut?.blur ?? 0) * 4);
  });

  it("drops lift's shadow by the same share of the text at any scale", () => {
    expect(shadowsDrawn("lift", { x: 1, y: 1 })?.offsetY).toBeCloseTo(8);
    expect(shadowsDrawn("lift", { x: 2, y: 2 })?.offsetY).toBeCloseTo(16);
  });
});
