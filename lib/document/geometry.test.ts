import { describe, expect, it } from "vitest";

import {
  createBoxElement,
  createId,
  createImageElement,
  createLinearElement,
  createTextElement,
} from "@/lib/document/factories";
import {
  canExportAt,
  clampCanvasSize,
  coverSize,
  fitWithin,
  fitZoom,
  gradientPoints,
  rotatedBounds,
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

describe("createId", () => {
  it("falls back to a v4 UUID when randomUUID is unavailable", () => {
    const original = crypto.randomUUID;
    Object.defineProperty(crypto, "randomUUID", {
      configurable: true,
      value: undefined,
    });
    try {
      const id = createId();
      expect(id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
      );
      expect(createId()).not.toBe(id);
    } finally {
      Object.defineProperty(crypto, "randomUUID", {
        configurable: true,
        value: original,
      });
    }
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

describe("rotatedBounds", () => {
  const page = { height: 720, width: 1280 };

  it("is a box's own box when it isn't turned", () => {
    const box = { ...createBoxElement("rect", page), x: 10, y: 20 };
    expect(rotatedBounds({ ...box, height: 50, width: 100 })).toEqual({
      height: 50,
      width: 100,
      x: 10,
      y: 20,
    });
  });

  it("turns a box about its top-left corner", () => {
    const box = {
      ...createBoxElement("rect", page),
      height: 50,
      rotation: 90,
      width: 100,
      x: 200,
      y: 100,
    };
    const bounds = rotatedBounds(box);
    expect(bounds.x).toBeCloseTo(150);
    expect(bounds.y).toBeCloseTo(100);
    expect(bounds.width).toBeCloseTo(50);
    expect(bounds.height).toBeCloseTo(100);
  });

  it("reaches half a line's stroke past its points", () => {
    const line = {
      ...createLinearElement("line", page),
      points: [0, 0, 100, -40] as [number, number, number, number],
      strokeWidth: 10,
      x: 50,
      y: 100,
    };
    expect(rotatedBounds(line)).toEqual({
      height: 50,
      width: 110,
      x: 45,
      y: 55,
    });
  });

  it("measures text by its laid out size, placing its lines by alignment", () => {
    const text = {
      ...createTextElement("heading", page),
      align: "right" as const,
      highlight: null,
      width: 400,
      x: 100,
      y: 50,
    };
    expect(rotatedBounds(text, { height: 120, width: 400 })).toEqual({
      height: 120,
      width: 400,
      x: 100,
      y: 50,
    });
    // Its longest line, at the right of its box
    expect(rotatedBounds(text, { height: 120, width: 250 })).toMatchObject({
      width: 250,
      x: 250,
    });
    // A curve's arc is centred on its width whatever the alignment
    expect(
      rotatedBounds({ ...text, curve: 40 }, { height: 200, width: 300 })
    ).toMatchObject({ height: 200, width: 300, x: 150 });
    // A highlight reaches past the lines
    expect(
      rotatedBounds(
        {
          ...text,
          fontSize: 100,
          highlight: { color: "#fff", paddingEm: 0.1, radiusEm: 0 },
        },
        { height: 120, width: 400 }
      )
    ).toEqual({ height: 140, width: 420, x: 90, y: 40 });
  });
});
