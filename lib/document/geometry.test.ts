import { describe, expect, it } from "vitest";

import { createImageElement } from "@/lib/document/factories";
import {
  canExportAt,
  clampCanvasSize,
  coverSize,
  fitWithin,
  fitZoom,
  gradientPoints,
  slugify,
} from "@/lib/document/geometry";

describe("geometry", () => {
  it("fits and covers while keeping aspect ratio", () => {
    const source = { height: 1000, width: 2000 };
    const bounds = { height: 720, width: 1280 };

    expect(fitWithin(source, bounds)).toEqual({ height: 640, width: 1280 });
    expect(coverSize(source, bounds)).toEqual({ height: 720, width: 1440 });
  });

  it("clamps canvas sizes to whole pixels in range", () => {
    expect(clampCanvasSize(1280.6)).toBe(1281);
    expect(clampCanvasSize(2)).toBe(16);
    expect(clampCanvasSize(99_999)).toBe(4096);
    expect(clampCanvasSize(Number.NaN)).toBe(16);
  });

  it("computes a zoom that fits the page inside padded viewport", () => {
    const zoom = fitZoom(
      { height: 720, width: 1280 },
      { height: 816, width: 1376 },
      48
    );
    expect(zoom).toBe(1);
  });

  it("guards exports above the Safari canvas limit", () => {
    expect(canExportAt({ height: 2160, width: 3840 }, 1)).toBe(true);
    expect(canExportAt({ height: 2160, width: 3840 }, 2)).toBe(false);
  });

  it("maps CSS gradient angles to start/end points", () => {
    const size = { height: 100, width: 200 };
    const toRight = gradientPoints(90, size);
    expect(toRight.start.x).toBeCloseTo(0);
    expect(toRight.end.x).toBeCloseTo(200);
    expect(toRight.start.y).toBeCloseTo(50);

    const toBottom = gradientPoints(180, size);
    expect(toBottom.start.y).toBeCloseTo(0);
    expect(toBottom.end.y).toBeCloseTo(100);
  });

  it("slugifies names for download filenames", () => {
    expect(slugify("  My THUMBNAIL: Épisode #12! ")).toBe(
      "my-thumbnail-episode-12"
    );
    expect(slugify("!!!")).toBe("design");
  });
});

describe("createImageElement", () => {
  const page = { height: 720, width: 1280 };
  const id = "8a5b3f4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b";

  it("keeps small images at natural size, centered", () => {
    const element = createImageElement({ height: 100, id, width: 200 }, page);
    expect(element).toMatchObject({ height: 100, width: 200, x: 540, y: 310 });
  });

  it("shrinks large images to 80% of the page and centers on a drop point", () => {
    const element = createImageElement(
      { height: 4000, id, width: 4000 },
      page,
      {
        x: 100,
        y: 100,
      }
    );
    expect(element.width).toBeCloseTo(576);
    expect(element.height).toBeCloseTo(576);
    expect(element.x).toBeCloseTo(100 - 288);
  });
});
