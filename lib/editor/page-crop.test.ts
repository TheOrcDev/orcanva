import { describe, expect, it } from "vitest";

import {
  createBoxElement,
  createDocument,
  createLinearElement,
} from "@/lib/document/factories";
import type { LineElement } from "@/lib/document/schema";
import { cropDocument } from "@/lib/editor/document-ops";
import {
  fullPage,
  keepBoxInPage,
  limitCropBox,
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
      })
    ).toEqual({ height: 500, width: 700, x: 0, y: 0 });
    expect(
      limitCropBox({
        anchor: "middle-right",
        min: 16,
        next: { height: 999, width: 5, x: 100, y: 7 },
        page: PAGE,
        previous,
      })
    ).toEqual({ height: 400, width: 16, x: 100, y: 100 });
    expect(
      limitCropBox({
        anchor: "bottom-center",
        min: 16,
        next: { height: 2000, width: 600, x: 100, y: 100 },
        page: PAGE,
        previous,
      })
    ).toEqual({ height: 620, width: 600, x: 100, y: 100 });
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
