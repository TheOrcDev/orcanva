import { describe, expect, it } from "vitest";

import {
  blendTile,
  featherEdges,
  outputRect,
  tileGrid,
} from "@/lib/upscale/tiles";

describe("tileGrid", () => {
  it("is one tile for a small image", () => {
    expect(tileGrid(200, 100)).toEqual([
      { height: 100, width: 200, x: 0, y: 0 },
    ]);
  });

  it("covers the image with overlapping tiles, the last ending at the edge", () => {
    const tiles = tileGrid(600, 256);
    expect(tiles.map((tile) => tile.x)).toEqual([0, 240, 344]);
    expect(tiles.every((tile) => tile.width === 256)).toBe(true);
    const last = tiles.at(-1);
    expect((last?.x ?? 0) + (last?.width ?? 0)).toBe(600);
  });

  it("goes row by row", () => {
    const tiles = tileGrid(500, 500);
    expect(tiles.map((tile) => [tile.x, tile.y])).toEqual([
      [0, 0],
      [240, 0],
      [244, 0],
      [0, 240],
      [240, 240],
      [244, 240],
      [0, 244],
      [240, 244],
      [244, 244],
    ]);
  });

  it("leaves no pixel uncovered", () => {
    const width = 1000;
    const height = 700;
    const covered = new Uint8Array(width * height);
    for (const tile of tileGrid(width, height)) {
      for (let { y } = tile; y < tile.y + tile.height; y += 1) {
        covered.fill(1, y * width + tile.x, y * width + tile.x + tile.width);
      }
    }
    expect(covered.every((pixel) => pixel === 1)).toBe(true);
  });
});

describe("outputRect", () => {
  it("scales a tile, sharing edges with its neighbours", () => {
    const tiles = tileGrid(600, 300);
    const rects = tiles.map((tile) => outputRect(tile, 2.5, 2.5));
    expect(rects[0]).toEqual({ height: 640, width: 640, x: 0, y: 0 });
    // Each tile ends where the rounded source edge lands
    for (const [index, rect] of rects.entries()) {
      const tile = tiles[index];
      expect(rect.x + rect.width).toBe(
        Math.round(((tile?.x ?? 0) + (tile?.width ?? 0)) * 2.5)
      );
    }
  });
});

describe("featherEdges", () => {
  it("fades a tile in over the ones left of and above it", () => {
    const tiles = tileGrid(500, 500);
    const [first, second, third, , middle] = tiles;
    if (!(first && second && third && middle)) {
      throw new Error("expected nine tiles");
    }
    expect(featherEdges(first, tiles, 4, 4)).toEqual({ left: 0, top: 0 });
    expect(featherEdges(second, tiles, 4, 4)).toEqual({ left: 64, top: 0 });
    // The last one in a row is pulled back, so it overlaps more
    expect(featherEdges(third, tiles, 4, 4)).toEqual({ left: 1008, top: 0 });
    expect(featherEdges(middle, tiles, 4, 4)).toEqual({ left: 64, top: 64 });
  });
});

const solid = (width: number, height: number, value: number) =>
  new Uint8ClampedArray(width * height * 4).fill(value);

describe("blendTile", () => {
  it("draws a tile as it is where nothing overlaps", () => {
    const output = { data: solid(4, 2, 0), width: 4 };
    blendTile(
      output,
      solid(2, 2, 200),
      { height: 2, width: 2, x: 2, y: 0 },
      { left: 0, top: 0 }
    );
    // The first row: two untouched pixels, then the tile's two
    expect(output.data.slice(0, 8)).toEqual(solid(2, 1, 0));
    expect(output.data.slice(8, 16)).toEqual(solid(2, 1, 200));
  });

  it("fades from what's there into the new tile across the overlap", () => {
    const output = { data: solid(4, 1, 100), width: 4 };
    blendTile(
      output,
      solid(4, 1, 200),
      { height: 1, width: 4, x: 0, y: 0 },
      { left: 4, top: 0 }
    );
    const reds = [0, 1, 2, 3].map((pixel) => output.data[pixel * 4]);
    // 1/8, 3/8, 5/8 and 7/8 of the way from the old 100 to the new 200,
    // with halves rounded to even as Uint8ClampedArray does
    expect(reds).toEqual([112, 138, 162, 188]);
  });
});
