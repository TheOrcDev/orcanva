import { parseHex } from "@/lib/document/color";
import type { Rgba } from "@/lib/document/color";

const TRANSPARENT: Rgba = [0, 0, 0, 0];
const resolved = new Map<string, Rgba>();

// The pickers store hex; any other CSS colour (an older or hand-made row)
// is read back from a one-pixel canvas, once per colour
export const effectRgba = (color: string): Rgba => {
  const hex = parseHex(color);
  if (hex) {
    return hex;
  }
  const known = resolved.get(color);
  if (known) {
    return known;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return TRANSPARENT;
  }
  context.fillStyle = color;
  context.fillRect(0, 0, 1, 1);
  const [red = 0, green = 0, blue = 0, alpha = 0] = context.getImageData(
    0,
    0,
    1,
    1
  ).data;
  const rgba: Rgba = [red, green, blue, alpha];
  resolved.set(color, rgba);
  return rgba;
};
