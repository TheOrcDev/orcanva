import { describe, expect, it } from "vitest";

import {
  createBoxElement,
  createDocument,
  createLinearElement,
} from "@/lib/document/factories";
import type { LineElement } from "@/lib/document/schema";
import { cropDocument } from "@/lib/editor/document-ops";
import {
  fitRatio,
  fullPage,
  keepBoxInPage,
  limitCropBox,
  ratioValue,
  wholeBox,
} from "@/lib/editor/page-crop";

const PAGE = { height: 720, width: 1280 };

describe("page crop", () => {
  it("rounds the box to whole pixels inside the page", () => {
    expect(
      wholeBox({ height: 300.4, width: 400.6, x: 10.4, y: 20.6 }, PAGE)
    ).toEqual({ height: 300, width: 401, x: 10, y: 21 });
    expect(wholeBox({ height: 2, width: 3, x: 1279, y: 719 }, PAGE)).toEqual({
      height: 16,
      width: 16,
      x: 1264,
      y: 704,
    });
    expect(wholeBox({ height: 900, width: 2000, x: -5, y: -5 }, PAGE)).toEqual(
      fullPage(PAGE)
    );
  });

  it("keeps a dragged box on the page", () => {
    const box = { height: 200, width: 300, x: 0, y: 0 };
    expect(keepBoxInPage({ ...box, x: -40, y: 900 }, PAGE)).toEqual({
      x: 0,
      y: 520,
    });
    expect(keepBoxInPage({ ...box, x: 1100, y: 100 }, PAGE)).toEqual({
      x: 980,
      y: 100,
    });
  });

  it("moves only the pulled sides, within the page and the minimum", () => {
    const previous = { height: 400, width: 600, x: 100, y: 100 };
    expect(
      limitCropBox({
        anchor: "top-left",
        min: 16,
        next: { height: 600, width: 800, x: -100, y: -100 },
        page: PAGE,
        previous,
        ratio: null,
      })
    ).toEqual({ height: 500, width: 700, x: 0, y: 0 });
    expect(
      limitCropBox({
        anchor: "middle-right",
        min: 16,
        next: { height: 999, width: 5, x: 100, y: 7 },
        page: PAGE,
        previous,
        ratio: null,
      })
    ).toEqual({ height: 400, width: 16, x: 100, y: 100 });
    expect(
      limitCropBox({
        anchor: "bottom-center",
        min: 16,
        next: { height: 2000, width: 600, x: 100, y: 100 },
        page: PAGE,
        previous,
        ratio: null,
      })
    ).toEqual({ height: 620, width: 600, x: 100, y: 100 });
  });

  it("reads ratios as width over height", () => {
    expect(ratioValue("free", PAGE)).toBeNull();
    expect(ratioValue("original", PAGE)).toBeCloseTo(16 / 9);
    expect(ratioValue("4:5", PAGE)).toBeCloseTo(0.8);
    expect(ratioValue("9:16", PAGE)).toBeCloseTo(9 / 16);
  });

  it("fits the biggest box of a ratio around the box's centre", () => {
    expect(fitRatio(fullPage(PAGE), 1, PAGE)).toEqual({
      height: 720,
      width: 720,
      x: 280,
      y: 0,
    });
    // Pushed back onto the page when the centre is near an edge
    expect(
      fitRatio({ height: 100, width: 100, x: 1180, y: 600 }, 1, PAGE)
    ).toEqual({ height: 720, width: 720, x: 560, y: 0 });
    expect(fitRatio(fullPage(PAGE), 2, PAGE)).toEqual({
      height: 640,
      width: 1280,
      x: 0,
      y: 40,
    });
  });

  it("keeps the ratio when a corner is pulled", () => {
    const previous = { height: 400, width: 400, x: 400, y: 200 };
    // Pulled wider than tall: the box shrinks to a square, the opposite
    // corner (bottom-right) staying put
    expect(
      limitCropBox({
        anchor: "top-left",
        min: 16,
        next: { height: 500, width: 700, x: 100, y: 100 },
        page: PAGE,
        previous,
        ratio: 1,
      })
    ).toEqual({ height: 500, width: 500, x: 300, y: 100 });
    // Past the page's bottom edge: the height limits the width too
    expect(
      limitCropBox({
        anchor: "bottom-right",
        min: 16,
        next: { height: 900, width: 900, x: 400, y: 200 },
        page: PAGE,
        previous,
        ratio: 1,
      })
    ).toEqual({ height: 520, width: 520, x: 400, y: 200 });
    // Never smaller than the minimum on either side
    expect(
      limitCropBox({
        anchor: "bottom-right",
        min: 16,
        next: { height: 1, width: 1, x: 400, y: 200 },
        page: PAGE,
        previous,
        ratio: 2,
      })
    ).toEqual({ height: 16, width: 32, x: 400, y: 200 });
  });

  it("makes the box the page, moving everything with it", () => {
    const document = createDocument(PAGE);
    const rect = { ...createBoxElement("rect", PAGE), x: 300, y: 200 };
    const line = { ...createLinearElement("line", PAGE), x: 50, y: 60 };
    document.elements.push(rect, line);

    const cropped = cropDocument(document, {
      height: 300.2,
      width: 500,
      x: 100,
      y: 100,
    });
    expect(cropped).toMatchObject({ height: 300, width: 500 });
    expect(cropped.elements[0]).toMatchObject({ x: 200, y: 100 });
    // Outside the new page, but kept
    const movedLine = cropped.elements[1] as LineElement;
    expect(movedLine).toMatchObject({ x: -50, y: -40 });
    expect(movedLine.points).toEqual(line.points);
    expect(cropped.background).toBe(document.background);

    expect(cropDocument(document, fullPage(PAGE))).toBe(document);
    const kept = cropDocument(document, {
      height: 500,
      width: 700,
      x: 0,
      y: 0,
    });
    expect(kept.elements).toBe(document.elements);
  });
});
