// Upscaling runs in tiles, so GPU memory stays flat however big the photo
// is. Neighbouring tiles overlap and are blended across the overlap, which
// hides the model's edge effects and leaves no seams.

export const TILE_SIZE = 256;
export const TILE_OVERLAP = 16;

// A part of the source image, in its pixels
export interface Tile {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Where tiles of `tile` px start along one side of `size` px, each stepping
// `tile − overlap` past the last; the final one is pulled back to end at the
// edge, so it may overlap its neighbour by more
const tileStarts = (size: number, tile: number, overlap: number): number[] => {
  if (size <= tile) {
    return [0];
  }
  const starts: number[] = [];
  for (let start = 0; start + tile < size; start += tile - overlap) {
    starts.push(start);
  }
  starts.push(size - tile);
  return starts;
};

// The tiles covering an image, row by row, left to right
export const tileGrid = (
  width: number,
  height: number,
  { overlap = TILE_OVERLAP, tile = TILE_SIZE } = {}
): Tile[] => {
  const columns = tileStarts(width, tile, overlap);
  return tileStarts(height, tile, overlap).flatMap((y) =>
    columns.map((x) => ({
      height: Math.min(tile, height),
      width: Math.min(tile, width),
      x,
      y,
    }))
  );
};

// A rectangle of the upscaled image, in its pixels
export interface OutputRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Where a tile lands in an output of `scaleX`, `scaleY` times the source.
// Rounded edges, so neighbouring tiles share theirs exactly.
export const outputRect = (
  tile: Tile,
  scaleX: number,
  scaleY: number
): OutputRect => {
  const x = Math.round(tile.x * scaleX);
  const y = Math.round(tile.y * scaleY);
  return {
    height: Math.round((tile.y + tile.height) * scaleY) - y,
    width: Math.round((tile.x + tile.width) * scaleX) - x,
    x,
    y,
  };
};

// How far into a tile's output rect the tiles drawn before it reach, left and
// above: that's where it fades in
export const featherEdges = (
  tile: Tile,
  tiles: readonly Tile[],
  scaleX: number,
  scaleY: number
): { left: number; top: number } => {
  let left = 0;
  let top = 0;
  for (const other of tiles) {
    if (other === tile) {
      break;
    }
    // The tile to its left in the same row, and the one above in its column
    if (other.y === tile.y && other.x < tile.x) {
      left = Math.max(
        left,
        Math.round((other.x + other.width) * scaleX) -
          Math.round(tile.x * scaleX)
      );
    }
    if (other.x === tile.x && other.y < tile.y) {
      top = Math.max(
        top,
        Math.round((other.y + other.height) * scaleY) -
          Math.round(tile.y * scaleY)
      );
    }
  }
  return { left: Math.max(0, left), top: Math.max(0, top) };
};

// How much of the new tile shows at `offset` px into a fade of `span` px:
// from almost none at its edge to all of it where the overlap ends
const ramp = (offset: number, span: number) =>
  offset >= span ? 1 : (offset + 0.5) / span;

// Draws an upscaled tile (RGBA, the size of `rect`) into the output, fading
// it in over what the earlier tiles drew where they overlap. Tiles go row by
// row, left to right, so each one only fades in on its left and top.
export const blendTile = (
  output: { data: Uint8ClampedArray; width: number },
  pixels: Uint8ClampedArray,
  rect: OutputRect,
  feather: { left: number; top: number }
): void => {
  for (let row = 0; row < rect.height; row += 1) {
    const fadeY = ramp(row, feather.top);
    for (let column = 0; column < rect.width; column += 1) {
      const weight = fadeY * ramp(column, feather.left);
      const from = (row * rect.width + column) * 4;
      const to = ((rect.y + row) * output.width + rect.x + column) * 4;
      for (let channel = 0; channel < 4; channel += 1) {
        const before = output.data[to + channel] ?? 0;
        const next = pixels[from + channel] ?? 0;
        output.data[to + channel] = before + (next - before) * weight;
      }
    }
  }
};
