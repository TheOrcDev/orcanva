import type { TextElement } from "@/lib/document/schema";
import { MIN_ELEMENT_SIZE } from "@/lib/editor/bake";
import { isFontReady } from "@/lib/fonts/loader";
import { canvasMeasurer } from "@/lib/text/canvas";
import { measureTextElement } from "@/lib/text/element-layout";
import type { FontReady } from "@/lib/text/element-layout";
import type { Measurer } from "@/lib/text/layout";

const ALIGN_SHARE = { center: 0.5, left: 0, right: 1 } as const;

// Display fonts run narrower and body fonts wider; the canvas measures the
// real thing when a document is available.
const AVERAGE_GLYPH_EM = 0.5;

// Fields that change how wide auto-width text draws
const TEXT_METRICS = [
  "fontId",
  "fontSize",
  "italic",
  "letterSpacingEm",
  "marks",
  "text",
  "uppercase",
  "weight",
] as const;

const hasOwn = (patch: object, key: string): boolean =>
  Object.hasOwn(patch, key);

const readyOrFallback: FontReady = (request) => {
  try {
    return isFontReady(request);
  } catch {
    return false;
  }
};

const displayText = (element: TextElement): string =>
  element.uppercase ? element.text.toUpperCase() : element.text;

// Longest line in characters, for a first width when we can't measure yet
export const estimateAutoWidth = (element: TextElement): number => {
  const longest = Math.max(
    1,
    ...displayText(element)
      .split("\n")
      .map((line) => [...line].length)
  );
  return Math.max(
    MIN_ELEMENT_SIZE,
    longest * element.fontSize * (AVERAGE_GLYPH_EM + element.letterSpacingEm)
  );
};

const canMeasureInBrowser = (): boolean =>
  typeof document !== "undefined" &&
  typeof document.createElement === "function";

// Width (and x, so alignment stays put) of auto-width text, from `measurer`
export const fitTextElement = (
  element: TextElement,
  measurer: Measurer,
  isReady: FontReady
): TextElement => {
  if (!element.autoWidth || element.curve !== 0) {
    return element;
  }
  const measured = measureTextElement(element, measurer, isReady);
  const width = Math.max(MIN_ELEMENT_SIZE, measured.width);
  if (Math.abs(width - element.width) < 0.5) {
    return element;
  }
  const share = ALIGN_SHARE[element.align];
  return {
    ...element,
    width,
    x: element.x + (element.width - width) * share,
  };
};

const measureFitted = (element: TextElement): TextElement | null => {
  if (!canMeasureInBrowser()) {
    return null;
  }
  try {
    return fitTextElement(
      { ...element, autoWidth: true },
      canvasMeasurer,
      readyOrFallback
    );
  } catch {
    return null;
  }
};

// A newly created auto-width text: measured from its font when we can,
// otherwise a character-count estimate
export const sizeNewText = (element: TextElement): TextElement => {
  const estimated = estimateAutoWidth(element);
  const measured = measureFitted(element);
  if (measured && measured.width > MIN_ELEMENT_SIZE) {
    return measured;
  }
  return { ...element, autoWidth: true, width: estimated };
};

// A patch that keeps auto-width text hugging its glyphs, or turns auto
// width off when the patch sets an explicit wrap width
export type TextPatch = Partial<Omit<TextElement, "id" | "type">>;

export const fittedTextPatch = (
  element: TextElement,
  patch: TextPatch,
  measurer: Measurer,
  isReady: FontReady
): TextPatch => {
  const setsWidth = hasOwn(patch, "width");
  const setsAuto = hasOwn(patch, "autoWidth");
  if (setsWidth && !setsAuto) {
    return { ...patch, autoWidth: false };
  }
  const next: TextElement = { ...element, ...patch };
  if (!next.autoWidth) {
    return patch;
  }
  const metricsChanged =
    TEXT_METRICS.some((key) => hasOwn(patch, key)) ||
    (setsAuto && next.autoWidth);
  if (!metricsChanged) {
    return patch;
  }
  const fitted = fitTextElement(next, measurer, isReady);
  return {
    ...patch,
    width: fitted.width,
    ...(hasOwn(patch, "x") ? {} : { x: fitted.x }),
  };
};

export const fittedTextPatchInBrowser = (
  element: TextElement,
  patch: TextPatch
): TextPatch => {
  try {
    return fittedTextPatch(element, patch, canvasMeasurer, readyOrFallback);
  } catch {
    return patch;
  }
};
