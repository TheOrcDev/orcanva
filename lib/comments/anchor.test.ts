import { describe, expect, it } from "vitest";

import { anchorFor, pinPoint } from "@/lib/comments/anchor";
import type { PinSource } from "@/lib/comments/anchor";
import {
  createBoxElement,
  createLinearElement,
  createTextElement,
} from "@/lib/document/factories";
import type { DesignElement } from "@/lib/document/schema";

const PAGE = { height: 720, width: 1280 };

const rect = (patch: Partial<DesignElement> = {}) =>
  ({
    ...createBoxElement("rect", PAGE),
    height: 100,
    id: "box",
    rotation: 0,
    width: 200,
    x: 100,
    y: 50,
    ...patch,
  }) as DesignElement;

const pinOn = (element: DesignElement, x: number, y: number): PinSource => {
  const anchor = anchorFor(element, { x, y });
  if (!anchor) {
    throw new Error("no anchor");
  }
  return { ...anchor, x, y };
};

const close = (point: { x: number; y: number }, x: number, y: number) => {
  expect(point.x).toBeCloseTo(x, 6);
  expect(point.y).toBeCloseTo(y, 6);
};

describe("pins on elements", () => {
  it("stays where it was put while nothing moves", () => {
    const element = rect();
    const placed = pinPoint(pinOn(element, 150, 80), element);
    expect(placed.state).toBe("element");
    close(placed, 150, 80);
  });

  it("follows the element when it moves", () => {
    const pin = pinOn(rect(), 150, 80);
    close(pinPoint(pin, rect({ x: 300, y: 10 })), 350, 40);
  });

  it("scales with the box, each way on its own", () => {
    const pin = pinOn(rect(), 200, 100);
    close(pinPoint(pin, rect({ height: 200, width: 400 })), 300, 150);
    close(pinPoint(pin, rect({ height: 50 })), 200, 75);
  });

  it("turns with the box about its top-left corner", () => {
    const pin = pinOn(rect(), 200, 50);
    close(pinPoint(pin, rect({ rotation: 90 })), 100, 150);
    // Placed on a turned box, it turns back with it
    const turned = rect({ rotation: 90 });
    const onTurned = pinOn(turned, 90, 60);
    close(pinPoint(onTurned, rect({ rotation: 0 })), 110, 60);
  });

  it("scales a pin on text with its width alone", () => {
    const text = {
      ...createTextElement("body", PAGE),
      rotation: 0,
      width: 300,
      x: 0,
      y: 0,
    } as DesignElement;
    const pin = pinOn(text, 30, 20);
    expect(pin.anchorHeight).toBeNull();
    close(pinPoint(pin, { ...text, width: 600 } as DesignElement), 60, 40);
  });

  it("keeps a pin on a line along it as its end moves", () => {
    const line = {
      ...createLinearElement("line", PAGE),
      points: [0, 0, 100, 0],
      x: 10,
      y: 10,
    } as DesignElement;
    const pin = pinOn(line, 60, 12);
    // Turned straight down and twice as long: halfway down, 2 to its side
    const moved = { ...line, points: [0, 0, 0, 200] } as DesignElement;
    close(pinPoint(pin, moved), 8, 110);
  });

  it("can't keep a pin on a line of no length", () => {
    const line = {
      ...createLinearElement("line", PAGE),
      points: [5, 5, 5, 5],
    } as DesignElement;
    expect(anchorFor(line, { x: 0, y: 0 })).toBeNull();
  });
});

describe("pins whose element is gone", () => {
  it("fall back to where they were put, and follow again once it's back", () => {
    const element = rect();
    const pin = pinOn(element, 150, 80);
    expect(pinPoint(pin, undefined)).toEqual({
      state: "detached",
      x: 150,
      y: 80,
    });
    close(pinPoint(pin, rect({ x: 0 })), 50, 80);
  });

  it("ignore another element", () => {
    const pin = pinOn(rect(), 150, 80);
    expect(pinPoint(pin, rect({ id: "other" })).state).toBe("detached");
  });

  it("pins on the page stay put", () => {
    expect(
      pinPoint(
        {
          anchorHeight: null,
          anchorWidth: null,
          anchorX: null,
          anchorY: null,
          elementId: null,
          x: 12,
          y: 34,
        },
        undefined
      )
    ).toEqual({ state: "page", x: 12, y: 34 });
  });
});
