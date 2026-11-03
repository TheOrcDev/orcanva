import { formatHex, parseHex } from "@/lib/document/color";

// rgb(1, 2, 3) or rgba(1, 2, 3, 0.5): what some browsers report instead of hex
const RGB_COLOR =
  /^rgba?\(\s*(?<red>\d{1,3})\s*,\s*(?<green>\d{1,3})\s*,\s*(?<blue>\d{1,3})\s*(?:,\s*[\d.]+\s*)?\)$/iu;
const OPAQUE = 255;

// Opens the browser's eyedropper
export type OpenEyeDropper = () => Promise<ColorSelectionResult>;

export const eyeDropperSupported = (): boolean =>
  typeof window !== "undefined" && typeof window.EyeDropper === "function";

export const openEyeDropper: OpenEyeDropper = () => {
  const EyeDropperApi = window.EyeDropper;
  if (!EyeDropperApi) {
    return Promise.reject(new Error("This browser has no eyedropper"));
  }
  return new EyeDropperApi().open();
};

// Red, green and blue (0–255) from hex or rgb(); null if it's neither
const readRgb = (color: string): [number, number, number] | null => {
  const trimmed = color.trim().toLowerCase();
  const groups = RGB_COLOR.exec(trimmed)?.groups;
  if (groups) {
    return [Number(groups.red), Number(groups.green), Number(groups.blue)];
  }
  const rgba = parseHex(trimmed);
  return rgba ? [rgba[0], rgba[1], rgba[2]] : null;
};

// The picked colour, opaque on screen, with the transparency of the one it
// replaces, so a see-through shadow stays see-through. Null if unreadable.
export const keepAlpha = (picked: string, current: string): string | null => {
  const rgb = readRgb(picked);
  if (!rgb) {
    return null;
  }
  return formatHex([...rgb, parseHex(current)?.[3] ?? OPAQUE]);
};

const isAbort = (error: unknown): boolean =>
  typeof error === "object" &&
  error !== null &&
  "name" in error &&
  error.name === "AbortError";

// Picks a colour off the screen in place of `current`. Null when the
// person pressed Esc, or the browser gave something unreadable.
export const pickScreenColor = async (
  current: string,
  open: OpenEyeDropper = openEyeDropper
): Promise<string | null> => {
  try {
    const { sRGBHex } = await open();
    return keepAlpha(sRGBHex, current);
  } catch (error) {
    if (isAbort(error)) {
      return null;
    }
    throw error;
  }
};
