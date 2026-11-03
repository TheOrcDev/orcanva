import { describe, expect, it } from "vitest";

import {
  createBoxElement,
  createDocument,
  createFrameElement,
  createImageElement,
  createLinearElement,
  createTextElement,
} from "@/lib/document/factories";
import { documentColors } from "@/lib/document/palette";
import type {
  DesignDocument,
  DesignElement,
  TextElement,
} from "@/lib/document/schema";

const PAGE = { height: 720, width: 1280 };

// On a white page unless it says otherwise
const page = (
  elements: DesignElement[],
  background?: DesignDocument["background"]
): DesignDocument => {
  const blank = createDocument(PAGE);
  return { ...blank, background: background ?? blank.background, elements };
};

const text = (fields: Partial<TextElement> = {}): TextElement => ({
  ...createTextElement("heading", PAGE),
  ...fields,
});

describe("documentColors", () => {
  it("finds colours in the background and every element type", () => {
    const rect = {
      ...createBoxElement("rect", PAGE),
      fill: "#FF0000",
      stroke: "#00ff00",
      strokeWidth: 4,
    };
    const ellipse = { ...createBoxElement("ellipse", PAGE), fill: "#0000ff" };
    const line = { ...createLinearElement("line", PAGE), stroke: "#111" };
    const arrow = { ...createLinearElement("arrow", PAGE), stroke: "#222222" };
    const image = createImageElement({ height: 10, id: "a", width: 10 }, PAGE);
    const frame = createFrameElement(PAGE);
    const styled = text({
      effect: {
        angle: 45,
        color: "#ff2e93",
        intensity: 50,
        kind: "neon",
        offsetEm: 0.1,
      },
      fill: "#333333",
      highlight: { color: "#ffcc00", paddingEm: 0.1, radiusEm: 0.1 },
      marks: [
        { end: 3, fill: "#abcdef", start: 0 },
        { end: 5, start: 4 },
      ],
      shadow: { blurEm: 0, color: "#00000080", offsetXEm: 0, offsetYEm: 0 },
      stroke: { color: "#444444", widthEm: 0.05 },
    });
    const elements = [rect, ellipse, line, arrow, image, frame, styled];

    expect(
      documentColors(
        page(elements, {
          angle: 90,
          stops: [
            { color: "#101010", offset: 0 },
            { color: "#202020", offset: 1 },
          ],
          type: "linear",
        })
      )
    ).toEqual([
      "#101010",
      "#202020",
      "#ff0000",
      "#00ff00",
      "#0000ff",
      "#111111",
      "#222222",
      "#333333",
      "#abcdef",
      "#444444",
      "#00000080",
      "#ffcc00",
    ]);
    expect(documentColors(page(elements), 20)).toContain("#ff2e93");
  });

  it("uses gradient stops in place of a gradient text's fill", () => {
    const gradient = text({
      fill: "#999999",
      fillGradient: {
        angle: 0,
        stops: [
          { color: "#ff512f", offset: 0 },
          { color: "#dd2476", offset: 1 },
        ],
      },
    });
    expect(documentColors(page([gradient]))).toEqual([
      "#ffffff",
      "#ff512f",
      "#dd2476",
    ]);
  });

  it("leaves out colours that don't show", () => {
    const hidden = text({
      effect: {
        angle: 45,
        color: "#123456",
        intensity: 50,
        kind: "lift",
        offsetEm: 0.08,
      },
      fill: "#00000000",
      stroke: { color: "#654321", widthEm: 0 },
    });
    const outline = {
      ...createBoxElement("rect", PAGE),
      fill: "red",
      stroke: "#777777",
      strokeWidth: 0,
    };
    expect(documentColors(page([hidden, outline]))).toEqual(["#ffffff"]);
  });

  it("puts the most-used first, once each, up to the limit", () => {
    const boxes = ["#AA0000", "#bb0000", "#aa0000", "#bb0000ff", "#a00"].map(
      (fill) => ({ ...createBoxElement("rect", PAGE), fill })
    );
    expect(documentColors(page(boxes))).toEqual([
      "#aa0000",
      "#bb0000",
      "#ffffff",
    ]);
    expect(documentColors(page(boxes), 2)).toEqual(["#aa0000", "#bb0000"]);

    const many = Array.from({ length: 20 }, (_, index) => ({
      ...createBoxElement("rect", PAGE),
      fill: `#0000${index.toString(16).padStart(2, "0")}`,
    }));
    expect(documentColors(page(many))).toHaveLength(12);
  });
});
