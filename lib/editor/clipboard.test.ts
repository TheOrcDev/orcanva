import { describe, expect, it } from "vitest";

import {
  createBoxElement,
  createGraphicElement,
  createTextElement,
} from "@/lib/document/factories";
import {
  parseClipboardElements,
  preparePastedElements,
  serializeElements,
} from "@/lib/editor/clipboard";
import { BUILTIN_GRAPHICS } from "@/lib/graphics/builtin";

const PAGE = { height: 720, width: 1280 };

describe("element clipboard", () => {
  it("round-trips elements through tagged clipboard text", () => {
    const elements = [
      createBoxElement("rect", PAGE),
      createTextElement("outlined", PAGE),
    ];
    expect(parseClipboardElements(serializeElements(elements))).toEqual(
      elements
    );
  });

  it("carries graphics with their art, so they paste into any design", () => {
    const graphics = BUILTIN_GRAPHICS.map((graphic) => ({
      ...createGraphicElement(graphic, PAGE),
      flipX: true,
      outline: { color: "#ffffff", width: 0.05 },
      strokeScale: 1.5,
    }));
    expect(parseClipboardElements(serializeElements(graphics))).toEqual(
      graphics
    );
  });

  it("keeps fields newer code added", () => {
    const rect = { ...createBoxElement("rect", PAGE), futureField: 7 };
    expect(parseClipboardElements(serializeElements([rect]))).toEqual([rect]);
  });

  it("pastes the elements it can read and leaves out the rest", () => {
    const rect = createBoxElement("rect", PAGE);
    const text = createTextElement("label", PAGE);
    const sticker = { ...createBoxElement("rect", PAGE), type: "hologram" };
    const clipboard = `orcanva/elements:${JSON.stringify({
      elements: [rect, sticker, text],
      version: 1,
    })}`;
    expect(parseClipboardElements(clipboard)).toEqual([rect, text]);
  });

  it("ignores foreign or invalid clipboard text", () => {
    expect(parseClipboardElements("hello")).toBeNull();
    expect(parseClipboardElements("orcanva/elements:{nope")).toBeNull();
    expect(
      parseClipboardElements('orcanva/elements:{"version":1,"elements":[{}]}')
    ).toBeNull();
  });

  it("gives pasted copies new ids, unlocks them, and offsets them", () => {
    const original = { ...createBoxElement("rect", PAGE), locked: true };
    const [copy] = preparePastedElements([original]);
    expect(copy?.id).not.toBe(original.id);
    expect(copy).toMatchObject({
      locked: false,
      x: original.x + 24,
      y: original.y + 24,
    });
  });
});
