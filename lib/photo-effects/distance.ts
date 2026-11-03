// The outline's maths without a GPU: the same seeds and the same soft edge
// as the jump flood (see SEED_SHADER and FIELD_SHADER), with distances from
// an exact Euclidean distance transform (Felzenszwalb and Huttenlocher).

const FAR = 1e20;
// A pixel the photo covers at least half of is a seed
const SEED_ALPHA = 128;

// Squared distances along one row or column, in place: `f` holds each
// pixel's own value (0 for seeds, FAR otherwise) and gets the smallest
// (q - p)² + f[p] over every p. The lower envelope of those parabolas is
// kept in `hull` (their p) and `bounds` (where each takes over).
const transformLine = (
  f: Float64Array,
  count: number,
  hull: Int32Array,
  bounds: Float64Array,
  out: Float64Array
) => {
  const value = (index: number) => f[index] ?? FAR;
  // Where the parabolas from q and p cross
  const crossing = (q: number, p: number) =>
    (value(q) + q * q - (value(p) + p * p)) / (2 * q - 2 * p);
  let top = 0;
  hull[0] = 0;
  bounds[0] = Number.NEGATIVE_INFINITY;
  bounds[1] = Number.POSITIVE_INFINITY;
  for (let q = 1; q < count; q += 1) {
    let s = crossing(q, hull[top] ?? 0);
    while (s <= (bounds[top] ?? Number.NEGATIVE_INFINITY)) {
      top -= 1;
      s = crossing(q, hull[top] ?? 0);
    }
    top += 1;
    hull[top] = q;
    bounds[top] = s;
    bounds[top + 1] = Number.POSITIVE_INFINITY;
  }
  top = 0;
  for (let q = 0; q < count; q += 1) {
    while ((bounds[top + 1] ?? Number.POSITIVE_INFINITY) < q) {
      top += 1;
    }
    const p = hull[top] ?? 0;
    out[q] = (q - p) * (q - p) + value(p);
  }
  for (let q = 0; q < count; q += 1) {
    f[q] = out[q] ?? FAR;
  }
};

// Each pixel's squared distance to the nearest seed's centre, from RGBA
// pixels (only alpha counts), row by row
export const squaredSeedDistances = (
  rgba: Uint8ClampedArray,
  width: number,
  height: number
): Float32Array => {
  const result = new Float32Array(width * height);
  const longest = Math.max(width, height);
  const line = new Float64Array(longest);
  const out = new Float64Array(longest);
  const hull = new Int32Array(longest);
  const bounds = new Float64Array(longest + 1);
  for (let x = 0; x < width; x += 1) {
    for (let y = 0; y < height; y += 1) {
      line[y] = (rgba[(y * width + x) * 4 + 3] ?? 0) >= SEED_ALPHA ? 0 : FAR;
    }
    transformLine(line, height, hull, bounds, out);
    for (let y = 0; y < height; y += 1) {
      result[y * width + x] = line[y] ?? FAR;
    }
  }
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      line[x] = result[y * width + x] ?? FAR;
    }
    transformLine(line, width, hull, bounds, out);
    for (let x = 0; x < width; x += 1) {
      result[y * width + x] = line[x] ?? FAR;
    }
  }
  return result;
};

// How much of a pixel an outline `width` px wide covers, `distance` px from
// the nearest seed: seeds sit about half a pixel inside the edge, and the
// last pixel fades
export const outlineCoverage = (distance: number, width: number): number =>
  Math.min(1, Math.max(0, width + 1 - distance));
