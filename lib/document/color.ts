// Colours as the pickers store them: #rgb, #rgba, #rrggbb or #rrggbbaa
const HEX_COLOR = /^#(?:[\da-f]{3,4}|[\da-f]{6}|[\da-f]{8})$/iu;
const OPAQUE = 255;

// Red, green, blue and alpha, each 0–255
export type Rgba = [number, number, number, number];

export const parseHex = (color: string): Rgba | null => {
  if (!HEX_COLOR.test(color)) {
    return null;
  }
  const digits = color.slice(1);
  const short = digits.length <= 4;
  const channel = (index: number) => {
    // A missing alpha reads as an empty pair
    const pair = short
      ? (digits[index] ?? "").repeat(2)
      : digits.slice(index * 2, index * 2 + 2);
    return pair.length === 2 ? Number.parseInt(pair, 16) : OPAQUE;
  };
  return [channel(0), channel(1), channel(2), channel(3)];
};

const hexPair = (value = 0) => value.toString(16).padStart(2, "0");

// #rrggbb, or #rrggbbaa when it's see-through
export const formatHex = (color: Rgba): string => {
  const [red, green, blue, alpha] = color.map((value) =>
    Math.min(OPAQUE, Math.max(0, Math.round(value)))
  );
  const opacity = alpha === OPAQUE ? "" : hexPair(alpha);
  return `#${hexPair(red)}${hexPair(green)}${hexPair(blue)}${opacity}`;
};

// One spelling per colour (#rrggbb, or #rrggbbaa when see-through), so
// lists of colours can be compared and deduplicated. Null for non-hex.
export const normalizeHex = (color: string): string | null => {
  const rgba = parseHex(color.trim());
  return rgba ? formatHex(rgba) : null;
};

// The colour `amount` (0–1) of the way from one to the other
export const mixRgba = (from: Rgba, to: Rgba, amount: number): Rgba => [
  from[0] + (to[0] - from[0]) * amount,
  from[1] + (to[1] - from[1]) * amount,
  from[2] + (to[2] - from[2]) * amount,
  from[3] + (to[3] - from[3]) * amount,
];
