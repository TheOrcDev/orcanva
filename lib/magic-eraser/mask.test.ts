import { describe, expect, it } from "vitest";

import {
  contextRect,
  cropMask,
  cropPixels,
  dilate,
  holeRadius,
  maskBounds,
  pasteBack,
} from "@/lib/magic-eraser/mask";
import type { Mask } from "@/lib/magic-eraser/mask";

// A mask from rows of "." (kept) and "#" (painted)
const mask = (...rows: string[]): Mask => ({
  data: Uint8Array.from(rows.join("").split(""), (cell) =>
    cell === "#" ? 255 : 0
  ),
  height: rows.length,
  width: rows[0]?.length ?? 0,
});

const draw = ({ data, width }: Mask): string[] =>
  Array.from({ length: data.length / width }, (_, row) =>
    [...data.subarray(row * width, (row + 1) * width)]
      .map((value) => (value > 0 ? "#" : "."))
      .join("")
  );

describe("maskBounds", () => {
  it("boxes every painted pixel", () => {
    expect(maskBounds(mask(".....", "..#..", ".#...", "....."))).toEqual({
      height: 2,
      width: 2,
      x: 1,
      y: 1,
    });
  });

  it("is null when nothing is painted", () => {
    expect(maskBounds(mask("...", "..."))).toBeNull();
  });
});

describe("contextRect", () => {
  const photo = { height: 2000, width: 3000 };

  it("is a square at least 512px around a small stroke", () => {
    expect(
      contextRect({ height: 20, width: 40, x: 1000, y: 1000 }, photo)
    ).toEqual({ height: 512, width: 512, x: 764, y: 754 });
  });

  it("is twice the stroke's longer side when that's more", () => {
    const rect = contextRect(
      { height: 300, width: 400, x: 1000, y: 800 },
      photo
    );
    expect(rect).toEqual({ height: 800, width: 800, x: 800, y: 550 });
  });

  it("moves inside the photo at its edges", () => {
    expect(
      contextRect({ height: 10, width: 10, x: 0, y: 1990 }, photo)
    ).toEqual({
      height: 512,
      width: 512,
      x: 0,
      y: 1488,
    });
  });

  it("is the whole photo when the photo is smaller", () => {
    expect(
      contextRect(
        { height: 10, width: 10, x: 100, y: 50 },
        { height: 300, width: 400 }
      )
    ).toEqual({ height: 300, width: 400, x: 0, y: 0 });
  });
});

describe("cropMask and cropPixels", () => {
  it("take the same part", () => {
    const painted = mask("#...", ".#..", "..#.", "...#");
    const rect = { height: 2, width: 2, x: 1, y: 1 };
    expect(draw(cropMask(painted, rect))).toEqual(["#.", ".#"]);
    const pixels = new Uint8ClampedArray(4 * 4 * 4).map((_, index) =>
      Math.floor(index / 4)
    );
    // Pixels 5, 6, 9 and 10, each as RGBA of its own index
    expect(
      cropPixels({ data: pixels, width: 4 }, rect).filter(
        (_, index) => index % 4 === 0
      )
    ).toEqual(new Uint8ClampedArray([5, 6, 9, 10]));
  });
});

describe("dilate", () => {
  it("grows the painted area by the radius in every direction", () => {
    expect(
      draw(dilate(mask(".....", ".....", "..#..", ".....", "....."), 1))
    ).toEqual([".....", ".###.", ".###.", ".###.", "....."]);
  });

  it("stops at the edges and makes soft pixels solid", () => {
    const soft: Mask = {
      data: Uint8Array.from([0, 0, 40, 0]),
      height: 1,
      width: 4,
    };
    expect([...dilate(soft, 1).data]).toEqual([0, 255, 255, 255]);
  });
});

describe("holeRadius", () => {
  it("is about two pixels at the model's 512px", () => {
    expect(holeRadius({ height: 512, width: 512, x: 0, y: 0 })).toBe(2);
    expect(holeRadius({ height: 2048, width: 1024, x: 0, y: 0 })).toBe(8);
    expect(holeRadius({ height: 100, width: 80, x: 0, y: 0 })).toBe(1);
  });
});

describe("pasteBack", () => {
  it("fills only the hole, and keeps the photo's alpha", () => {
    // A 3 × 1 photo: opaque, half see-through, clear
    const photo = {
      data: new Uint8ClampedArray([
        10, 10, 10, 255, 20, 20, 20, 128, 30, 30, 30, 0,
      ]),
      width: 3,
    };
    const filled = new Uint8ClampedArray([99, 98, 97, 255, 89, 88, 87, 255]);
    pasteBack(photo, filled, mask("##"), { height: 1, width: 2, x: 1, y: 0 });
    expect([...photo.data]).toEqual([
      10, 10, 10, 255, 99, 98, 97, 128, 89, 88, 87, 0,
    ]);
  });
});
