import type { TextMark } from "@/lib/document/schema";

// What a mark can change about the text it covers
export type MarkStyle = Omit<TextMark, "start" | "end">;

const STYLE_KEYS = [
  "fill",
  "fontId",
  "italic",
  "sizeEm",
  "strike",
  "underline",
  "weight",
] as const satisfies readonly (keyof MarkStyle)[];

export type MarkKey = (typeof STYLE_KEYS)[number];

const isEmpty = (style: MarkStyle) =>
  STYLE_KEYS.every((key) => style[key] === undefined);

const sameStyle = (a: MarkStyle, b: MarkStyle) =>
  STYLE_KEYS.every((key) => a[key] === b[key]);

// Drops keys that are undefined, so styles compare and serialize cleanly
const compact = (style: MarkStyle): MarkStyle => {
  const result: MarkStyle = {};
  for (const key of STYLE_KEYS) {
    if (style[key] !== undefined) {
      Object.assign(result, { [key]: style[key] });
    }
  }
  return result;
};

// One style per character of the text (later marks win where they overlap)
const stylesOf = (length: number, marks: readonly TextMark[]): MarkStyle[] => {
  const styles: MarkStyle[] = Array.from({ length }, () => ({}));
  for (const mark of marks) {
    const { end, start, ...style } = mark;
    for (
      let index = Math.max(0, start);
      index < Math.min(length, end);
      index += 1
    ) {
      styles[index] = { ...styles[index], ...compact(style) };
    }
  }
  return styles;
};

// Marks back from per-character styles: sorted, apart, neighbours with the
// same style merged, unstyled stretches left out
const marksOf = (styles: readonly MarkStyle[]): TextMark[] => {
  const marks: TextMark[] = [];
  let index = 0;
  while (index < styles.length) {
    const style = styles[index] ?? {};
    let end = index + 1;
    while (end < styles.length && sameStyle(styles[end] ?? {}, style)) {
      end += 1;
    }
    if (!isEmpty(style)) {
      marks.push({ ...compact(style), end, start: index });
    }
    index = end;
  }
  return marks;
};

// Cleans marks up: inside the text, apart, sorted and merged
export const normalizeMarks = (
  text: string,
  marks: readonly TextMark[]
): TextMark[] => marksOf(stylesOf(text.length, marks));

// Sets (or, with undefined, clears) style keys on characters [start, end)
export const applyMark = (
  text: string,
  marks: readonly TextMark[],
  start: number,
  end: number,
  patch: Partial<MarkStyle>
): TextMark[] => {
  const styles = stylesOf(text.length, marks);
  for (
    let index = Math.max(0, start);
    index < Math.min(text.length, end);
    index += 1
  ) {
    styles[index] = compact({ ...styles[index], ...patch });
  }
  return marksOf(styles);
};

// Takes a key off every mark, e.g. when the whole text gets a new colour
export const clearMarkKey = (
  text: string,
  marks: readonly TextMark[],
  key: MarkKey
): TextMark[] =>
  marksOf(
    stylesOf(text.length, marks).map((style) =>
      compact({ ...style, [key]: undefined })
    )
  );

// Keeps marks on the characters they styled when the text is edited: the
// unchanged start and end keep theirs, and typed characters take the style
// of the character before them (or after, at the very start)
export const rebaseMarks = (
  before: string,
  after: string,
  marks: readonly TextMark[]
): TextMark[] => {
  if (marks.length === 0 || before === after) {
    return marks.length === 0 ? [] : normalizeMarks(after, marks);
  }
  let prefix = 0;
  const shortest = Math.min(before.length, after.length);
  while (prefix < shortest && before[prefix] === after[prefix]) {
    prefix += 1;
  }
  let suffix = 0;
  while (
    suffix < shortest - prefix &&
    before[before.length - 1 - suffix] === after[after.length - 1 - suffix]
  ) {
    suffix += 1;
  }
  const old = stylesOf(before.length, marks);
  const typed = after.length - prefix - suffix;
  const inherited = old[prefix - 1] ?? old[before.length - suffix] ?? {};
  const styles = [
    ...old.slice(0, prefix),
    ...Array.from({ length: typed }, () => ({ ...inherited })),
    ...old.slice(before.length - suffix),
  ];
  return marksOf(styles);
};

// The text cut where its style changes, each piece with its marks' style
export const styledSegments = (
  text: string,
  marks: readonly TextMark[]
): { text: string; style: MarkStyle; start: number }[] => {
  if (marks.length === 0) {
    return [{ start: 0, style: {}, text }];
  }
  const styles = stylesOf(text.length, marks);
  const segments: { text: string; style: MarkStyle; start: number }[] = [];
  let index = 0;
  while (index < text.length) {
    const style = styles[index] ?? {};
    let end = index + 1;
    while (end < text.length && sameStyle(styles[end] ?? {}, style)) {
      end += 1;
    }
    segments.push({ start: index, style, text: text.slice(index, end) });
    index = end;
  }
  return segments.length > 0 ? segments : [{ start: 0, style: {}, text }];
};

// A key's value across characters [start, end): one value, or "mixed"
export const markValue = <K extends MarkKey>(
  text: string,
  marks: readonly TextMark[],
  start: number,
  end: number,
  key: K
): MarkStyle[K] | "mixed" => {
  const styles = stylesOf(text.length, marks).slice(
    start,
    Math.max(start + 1, end)
  );
  const [first] = styles;
  const value = first?.[key];
  return styles.every((style) => style[key] === value) ? value : "mixed";
};
