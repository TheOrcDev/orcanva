import type { TextElement } from "@/lib/document/schema";
import type { ElementPatch } from "@/lib/editor/document-ops";
import type { TextRange } from "@/lib/text/dom-text";
import { applyMark, clearMarkKey, markValue } from "@/lib/text/marks";
import type { MarkKey, MarkStyle } from "@/lib/text/marks";

// The text's own value for what a mark can set
const ownValue = <K extends MarkKey>(
  element: TextElement,
  key: K
): MarkStyle[K] => {
  if (key === "sizeEm") {
    return 1 as MarkStyle[K];
  }
  return element[key as Exclude<MarkKey, "sizeEm">] as MarkStyle[K];
};

const isRange = (range: TextRange | null): range is TextRange =>
  range !== null && range.end > range.start;

// What the selected characters show for a key (the text's own value where
// no mark sets it), or "mixed"; with nothing selected, the text's own
export const styleValue = <K extends MarkKey>(
  element: TextElement,
  range: TextRange | null,
  key: K
): MarkStyle[K] | "mixed" => {
  if (!isRange(range)) {
    return ownValue(element, key);
  }
  const value = markValue(
    element.text,
    element.marks,
    range.start,
    range.end,
    key
  );
  return value === undefined ? ownValue(element, key) : value;
};

// Sets a style on the selected characters, or on the whole text when none
// are selected (dropping parts that set it differently). A part set to the
// text's own value needs no mark.
export const styleText = <K extends MarkKey>(
  element: TextElement,
  range: TextRange | null,
  key: K,
  value: NonNullable<MarkStyle[K]>
): ElementPatch => {
  if (isRange(range)) {
    const own = ownValue(element, key) === value;
    return {
      marks: applyMark(element.text, element.marks, range.start, range.end, {
        [key]: own ? undefined : value,
      }),
    };
  }
  const marks = clearMarkKey(element.text, element.marks, key);
  if (key === "sizeEm") {
    return { fontSize: element.fontSize * Number(value), marks };
  }
  return { [key]: value, marks } as ElementPatch;
};

// Bold, italic, underline and strikethrough flip on unless every selected
// character already has them
export const toggleStyle = (
  element: TextElement,
  range: TextRange | null,
  key: "italic" | "underline" | "strike"
): ElementPatch =>
  styleText(element, range, key, styleValue(element, range, key) !== true);

export const BOLD_WEIGHT = 700;
export const REGULAR_WEIGHT = 400;

export const isBold = (weight: number | "mixed" | undefined) =>
  typeof weight === "number" && weight >= 600;

export const toggleBold = (
  element: TextElement,
  range: TextRange | null
): ElementPatch =>
  styleText(
    element,
    range,
    "weight",
    isBold(styleValue(element, range, "weight")) ? REGULAR_WEIGHT : BOLD_WEIGHT
  );
