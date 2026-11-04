import { fullPhotoSize, isFullCrop, refitCrop } from "@/lib/document/crop";
import { rotatedBounds } from "@/lib/document/geometry";
import type { Point, Rect, Size } from "@/lib/document/geometry";
import type {
  DesignDocument,
  DesignElement,
  ImageCrop,
  LinearElement,
  TextElement,
} from "@/lib/document/schema";
import { resizeDocument } from "@/lib/editor/document-ops";
import { selectionUnits } from "@/lib/editor/groups";
import { unionRect } from "@/lib/editor/snapping";
import { scalePhotoEffects } from "@/lib/photo-effects/geometry";

// Magic Resize: a design laid out again at another size, adapting its
// layout instead of stretching or cropping the page.
//
// - What builds the page (a full-bleed photo, a backdrop, a band or a
//   panel across it, a divider) stretches with the page, and photos refit
//   their crop so nothing distorts.
// - Everything else keeps its shape, scaled evenly by the smaller of the
//   two ratios, and keeps its place: on each axis it stays by the edge or
//   the centre it was nearest to. What touches or overlaps moves together,
//   as groups do, and a small thing beside a text (an icon before a label,
//   a sticker on a title) moves with the text.
// - Text grows with the page's area instead, and re-wraps at a width that
//   follows the page's, so it takes more lines where the page got narrower.
//   Texts above one another, with whatever sits between them, stay a
//   column: laid out top to bottom, and made smaller together when the page
//   is too short for them.
//
// The rules were tuned by laying the starter templates out for a square,
// a story, an X post and a LinkedIn banner and looking at them.

export interface TextSize extends Size {
  // How wide the drawn text is (its longest line); the width when unknown
  inkWidth?: number;
  // A word had to break across lines to fit the width
  splitsWords?: boolean;
}

// A text's box as laid out: its wrap width × its lines' height, or its
// arc's box
export type MeasureText = (text: TextElement) => TextSize;

// What a text covers on the page: its longest line rather than its whole
// wrap width
const inkOf = (size: TextSize): Size => ({
  height: size.height,
  width: size.inkWidth ?? size.width,
});

// The thresholds, in one place
export const MAGIC_RESIZE_RULES = {
  // Texts (and what's between them) this close above one another, as a
  // share of the page's height, stay a column…
  columnGap: 0.1,
  // …or this close when the page gets shorter
  columnGapShorter: 0.2,
  // Something beside a text follows it when it's no taller or wider than
  // this many of its lines…
  followLines: 4,
  // …and this share of the page's shorter side
  followSize: 0.25,
  // Shapes, photos and graphics this close (as a share of the page's
  // shorter side) move together
  gap: 0.02,
  // Text keeps this share of the new page's shorter side clear at the edges
  margin: 0.04,
  // Text shrinks to fit, but not below this share of the shorter side
  minFont: 0.025,
  // So do ones that overlap by this share of the smaller one's box
  overlap: 0.1,
  // Pages whose shapes differ by less than this are the same shape: the
  // design just scales
  sameShape: 0.01,
  // Covering this share of a page axis makes an element part of the page's
  // structure (a full-bleed photo, a backdrop, a band or panel)
  span: 0.9,
  // A text moves with a shape when this share of it lies on the shape…
  textOn: 0.5,
  // …and the shape is no bigger than this many times the text (a label,
  // a badge or a band rather than a backdrop)
  tightFit: 4,
} as const;

const MAX_FONT_SIZE = 4000;
const MIN_STROKE_WIDTH = 0.5;
const MAX_STROKE_WIDTH = 500;
const MAX_LENGTH = 100_000;
// Steps of the search for a text's largest size that fits
const FIT_STEPS = 12;
// A page px either way still counts as on the page
const PAGE_TOLERANCE = 1;
// Frame shapes that stay right-angled when stretched
const RECT_SHAPES = new Set(["square", "rounded"]);

interface Resize {
  from: Size;
  to: Size;
  sx: number;
  sy: number;
  // The smaller and larger ratio, and their geometric mean
  lo: number;
  hi: number;
  mid: number;
  // Room text keeps from the new page's edges, in px
  margin: number;
  shorter: number;
  // The page keeps its shape: everything scales by the same amount
  even: boolean;
}

type Axis = "x" | "y";

const lengthOf = (size: Size, axis: Axis) =>
  axis === "x" ? size.width : size.height;

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const clampLength = (value: number) => clamp(value, 1e-3, MAX_LENGTH);

const ratioOf = (resize: Resize, axis: Axis) =>
  axis === "x" ? resize.sx : resize.sy;

// ---------------------------------------------------------------------------
// Scaling one element

const scaleStroke = (width: number, factor: number) =>
  width === 0 ? 0 : clamp(width * factor, 0, MAX_STROKE_WIDTH);

const scaleLineStroke = (width: number, factor: number) =>
  clamp(width * factor, MIN_STROKE_WIDTH, MAX_STROKE_WIDTH);

// The element `factor` times bigger, its top-left corner moved from
// `origin` to `target` and everything else in proportion. Elements turn
// about their top-left corner, so this keeps a turned one's look too.
// Text and stroke widths in em, graphics' outlines and line weights, and
// crops are relative, so they need nothing.
export const scaleElementEvenly = <T extends DesignElement>(
  element: T,
  factor: number,
  origin: Point,
  target: Point
): T => {
  const x = target.x + (element.x - origin.x) * factor;
  const y = target.y + (element.y - origin.y) * factor;
  const next = element as DesignElement;
  switch (next.type) {
    case "rect":
    case "ellipse": {
      return {
        ...next,
        cornerRadius: next.cornerRadius * factor,
        height: clampLength(next.height * factor),
        strokeWidth: scaleStroke(next.strokeWidth, factor),
        width: clampLength(next.width * factor),
        x,
        y,
      } as T;
    }
    case "image": {
      return {
        ...next,
        ...scalePhotoEffects(next, factor),
        cornerRadius: next.cornerRadius * factor,
        height: clampLength(next.height * factor),
        width: clampLength(next.width * factor),
        x,
        y,
      } as T;
    }
    case "frame": {
      return {
        ...next,
        ...scalePhotoEffects(next, factor),
        height: clampLength(next.height * factor),
        width: clampLength(next.width * factor),
        x,
        y,
      } as T;
    }
    case "graphic": {
      return {
        ...next,
        height: clampLength(next.height * factor),
        width: clampLength(next.width * factor),
        x,
        y,
      } as T;
    }
    case "text": {
      return {
        ...next,
        fontSize: clamp(next.fontSize * factor, 1, MAX_FONT_SIZE),
        width: clampLength(next.width * factor),
        x,
        y,
      } as T;
    }
    case "line":
    case "arrow": {
      const [x1, y1, x2, y2] = next.points;
      return {
        ...next,
        points: [x1 * factor, y1 * factor, x2 * factor, y2 * factor],
        strokeWidth: scaleLineStroke(next.strokeWidth, factor),
        x,
        y,
      } as T;
    }
    default: {
      return element;
    }
  }
};

// A photo's crop once its box changes from `box` to `next`: the whole
// photo grows by `scale` like everything else on the page, and further
// where it has to, to cover the box without distorting. Returns how much
// bigger the photo is drawn, which its effects grow by.
const refitPhoto = (
  crop: ImageCrop | null,
  box: Size,
  next: Size,
  scale: number
): { crop: ImageCrop | null; factor: number } => {
  const photo = fullPhotoSize(box, crop);
  const refit = refitCrop(
    crop,
    { height: photo.height * scale, width: photo.width * scale },
    { height: box.height * scale, width: box.width * scale },
    next
  );
  return {
    crop: isFullCrop(refit) ? null : refit,
    factor: next.width / refit.width / photo.width,
  };
};

// A box element given a new box. Photos refit their crop so the picture
// keeps its shape; strokes and corners follow the page's smaller ratio.
const withBox = (
  element: DesignElement,
  box: Rect,
  resize: Resize
): DesignElement => {
  const size = {
    height: clampLength(box.height),
    width: clampLength(box.width),
  };
  const placed = { ...size, x: box.x, y: box.y };
  switch (element.type) {
    case "rect":
    case "ellipse": {
      return {
        ...element,
        ...placed,
        cornerRadius: element.cornerRadius * resize.lo,
        strokeWidth: scaleStroke(element.strokeWidth, resize.lo),
      };
    }
    case "image": {
      const { crop, factor } = refitPhoto(
        element.crop,
        element,
        size,
        resize.lo
      );
      return {
        ...element,
        ...placed,
        ...scalePhotoEffects(element, factor),
        cornerRadius: element.cornerRadius * resize.lo,
        crop,
      };
    }
    case "frame": {
      if (!element.assetId) {
        return {
          ...element,
          ...placed,
          ...scalePhotoEffects(element, resize.lo),
        };
      }
      const { crop, factor } = refitPhoto(
        element.crop,
        element,
        size,
        resize.lo
      );
      return {
        ...element,
        ...placed,
        ...scalePhotoEffects(element, factor),
        crop,
      };
    }
    default: {
      return element;
    }
  }
};

// ---------------------------------------------------------------------------
// Where things go on each axis

type Anchor = "start" | "center" | "end";

// The nearest of the axis's start, centre and end; ties go to the centre,
// and so does anything reaching past both ends
const anchorOf = (start: number, length: number, page: number): Anchor => {
  const end = page - (start + length);
  if (start <= 0 && end <= 0) {
    return "center";
  }
  const offset = Math.abs(start + length / 2 - page / 2);
  if (offset <= start && offset <= end) {
    return "center";
  }
  return start < end ? "start" : "end";
};

const spanOf = (bounds: Rect, axis: Axis) =>
  axis === "x"
    ? { length: bounds.width, start: bounds.x }
    : { length: bounds.height, start: bounds.y };

// Where something that took up `bounds` on the old page starts on the new
// one, now `nextLength` long: gaps to the edge it was nearest to scale by
// the smaller ratio, offsets from the centre by the axis's own
const placeOnAxis = (
  bounds: Rect,
  axis: Axis,
  nextLength: number,
  resize: Resize
): number => {
  const { length, start } = spanOf(bounds, axis);
  const page = lengthOf(resize.from, axis);
  const nextPage = lengthOf(resize.to, axis);
  switch (anchorOf(start, length, page)) {
    case "start": {
      return start * resize.lo;
    }
    case "end": {
      return nextPage - (page - start - length) * resize.lo - nextLength;
    }
    default: {
      const offset = start + length / 2 - page / 2;
      return nextPage / 2 + offset * ratioOf(resize, axis) - nextLength / 2;
    }
  }
};

const isOnPage = (bounds: Rect, page: Size) =>
  bounds.x >= -PAGE_TOLERANCE &&
  bounds.y >= -PAGE_TOLERANCE &&
  bounds.x + bounds.width <= page.width + PAGE_TOLERANCE &&
  bounds.y + bounds.height <= page.height + PAGE_TOLERANCE;

// Moves a span that was on the page back onto it, `before` and `after`
// from its ends where it fits
const keepOnAxis = (
  start: number,
  length: number,
  page: number,
  [before, after]: [number, number]
) => {
  if (length >= page) {
    return (page - length) / 2;
  }
  const spare = page - length;
  const low = Math.min(before, spare / 2);
  const high = Math.min(after, spare / 2);
  return clamp(start, low, page - high - length);
};

// Where a unit's box starts on the new page, `size` big there. One that
// was on the page stays on it, and up to `inset` from its edges (but no
// further than it was, scaled), where it fits.
const placeBox = (
  bounds: Rect,
  size: Size,
  resize: Resize,
  inset = 0
): Point => {
  const x = placeOnAxis(bounds, "x", size.width, resize);
  const y = placeOnAxis(bounds, "y", size.height, resize);
  if (!isOnPage(bounds, resize.from)) {
    return { x, y };
  }
  const insets = (axis: Axis): [number, number] => {
    const { length, start } = spanOf(bounds, axis);
    const end = lengthOf(resize.from, axis) - start - length;
    return [
      Math.min(inset, Math.max(0, start) * resize.lo),
      Math.min(inset, Math.max(0, end) * resize.lo),
    ];
  };
  return {
    x: keepOnAxis(x, size.width, resize.to.width, insets("x")),
    y: keepOnAxis(y, size.height, resize.to.height, insets("y")),
  };
};

// How much smaller than `scale` a unit that was on the page has to get to
// stay on it
const fitScale = (bounds: Rect, scale: number, resize: Resize): number =>
  isOnPage(bounds, resize.from)
    ? Math.min(
        scale,
        resize.to.width / Math.max(bounds.width, 1e-6),
        resize.to.height / Math.max(bounds.height, 1e-6)
      )
    : scale;

// ---------------------------------------------------------------------------
// Units: what moves as one

// Scaled evenly as one: a group, things that overlap, or one element
interface Rigid {
  kind: "rigid";
  elements: DesignElement[];
  bounds: Rect;
}

// Part of the page's structure: stretches with the page
interface Stretch {
  kind: "stretch";
  element: DesignElement;
  spans: Record<Axis, boolean>;
}

// A text on its own, with whatever sits beside it as part of it (an icon
// before a label, a sticker on a title), which follows it
interface TextPiece {
  kind: "text";
  element: TextElement;
  bounds: Rect;
  size: TextSize;
  followers: Rigid[];
}

type Piece = TextPiece | Rigid;

// Texts, and what sits between them, above one another (a label, a title,
// a photo, a caption): each text grows with the page's area and re-wraps,
// and they all stay a column
interface Column {
  kind: "column";
  pieces: Piece[];
}

type Unit = Rigid | Stretch | Column;

interface Placed {
  element: DesignElement;
  // What it draws (a text's lines, not its whole wrap width)
  bounds: Rect;
  // Its whole box (a text's wrap width)
  box: Rect;
}

// The share of an axis of the page an element covers
const coverage = (bounds: Rect, page: Size, axis: Axis): number => {
  const { length, start } = spanOf(bounds, axis);
  const pageLength = lengthOf(page, axis);
  const covered = Math.min(start + length, pageLength) - Math.max(start, 0);
  return Math.max(0, covered) / pageLength;
};

const isLinear = (element: DesignElement): element is LinearElement =>
  element.type === "line" || element.type === "arrow";

// Whether an element is part of the page's structure, which stretches with
// the page rather than keeping its shape: a full-bleed photo, a backdrop, a
// band or panel across a whole axis, or a divider
const isStructure = (
  element: DesignElement,
  spans: Record<Axis, boolean>
): boolean => {
  const both = spans.x && spans.y;
  switch (element.type) {
    case "image": {
      return both;
    }
    case "ellipse": {
      return both;
    }
    case "frame": {
      return (spans.x || spans.y) && RECT_SHAPES.has(element.shape);
    }
    case "rect":
    case "line":
    case "arrow": {
      return spans.x || spans.y;
    }
    default: {
      return false;
    }
  }
};

const areaOf = (box: Rect) => Math.max(0, box.width) * Math.max(0, box.height);

// How far two spans overlap on an axis (negative: the gap between them)
const overlapOn = (a: Rect, b: Rect, axis: Axis): number => {
  const first = spanOf(a, axis);
  const second = spanOf(b, axis);
  return (
    Math.min(first.start + first.length, second.start + second.length) -
    Math.max(first.start, second.start)
  );
};

const overlapOf = (a: Rect, b: Rect): number =>
  Math.max(0, overlapOn(a, b, "x")) * Math.max(0, overlapOn(a, b, "y"));

const gapBetween = (a: Rect, b: Rect): number =>
  Math.max(0, -overlapOn(a, b, "x"), -overlapOn(a, b, "y"));

// Whether `item` moves with `host`: shapes, photos and graphics that
// overlap or nearly touch; a text sitting on a shape that fits it snugly
// (a label on its chip, a number in its badge); or texts laid over each
// other
const movesWith = (item: Placed, host: Placed, page: Size): boolean => {
  const area = areaOf(item.bounds);
  const hostArea = areaOf(host.bounds);
  const shared = overlapOf(item.bounds, host.bounds);
  if (host.element.type === "text") {
    return (
      item.element.type === "text" &&
      shared >= MAGIC_RESIZE_RULES.textOn * Math.min(area, hostArea)
    );
  }
  if (item.element.type === "text") {
    // The text's whole box, which a label's chip or a badge was sized to
    const box = areaOf(item.box);
    return (
      overlapOf(item.box, host.bounds) >= MAGIC_RESIZE_RULES.textOn * box &&
      hostArea <= MAGIC_RESIZE_RULES.tightFit * box
    );
  }
  if (isLinear(host.element) && !isLinear(item.element)) {
    // A line's box is mostly empty: it only joins what's beside it
    return gapBetween(item.bounds, host.bounds) === 0;
  }
  return (
    shared >= MAGIC_RESIZE_RULES.overlap * Math.min(area, hostArea) ||
    gapBetween(item.bounds, host.bounds) <=
      MAGIC_RESIZE_RULES.gap * Math.min(page.width, page.height)
  );
};

// Joins items into sets wherever `linked` says two belong together,
// keeping their order
const linkedSets = <T>(
  items: readonly T[],
  linked: (item: T, other: T) => boolean
): T[][] => {
  const parents = items.map((_, index) => index);
  const find = (index: number): number => {
    let root = index;
    while (parents[root] !== root) {
      root = parents[root] ?? root;
    }
    return root;
  };
  for (const [index, item] of items.entries()) {
    for (const [other, candidate] of items.entries()) {
      if (
        other !== index &&
        find(index) !== find(other) &&
        linked(item, candidate)
      ) {
        parents[find(index)] = find(other);
      }
    }
  }
  const sets = new Map<number, T[]>();
  for (const [index, item] of items.entries()) {
    const root = find(index);
    sets.set(root, [...(sets.get(root) ?? []), item]);
  }
  return [...sets.values()];
};

// Two boxes side by side: they overlap by half the smaller one's height
const sharesRow = (a: Rect, b: Rect): boolean =>
  overlapOn(a, b, "y") >= 0.5 * Math.min(a.height, b.height);

// Two pieces belong in one column when at least one is text, they overlap
// across, and the gap between them is small (less small when the page gets
// shorter, so they shrink together rather than run into each other), or
// when they're things in one row. Text side by side, pieces overlapping a
// lot and anything bleeding off the page don't.
const stacksOn = (a: Piece, b: Piece, resize: Resize): boolean => {
  const page = resize.from;
  // Something bleeding off the page is backdrop, not part of a column
  if (
    (a.kind === "rigid" && !isOnPage(a.bounds, page)) ||
    (b.kind === "rigid" && !isOnPage(b.bounds, page))
  ) {
    return false;
  }
  if (a.kind !== "text" && b.kind !== "text") {
    // Things in a row (cards, list items) go into a column together
    const narrower = Math.min(a.bounds.width, b.bounds.width);
    return (
      sharesRow(a.bounds, b.bounds) &&
      -overlapOn(a.bounds, b.bounds, "x") <= narrower
    );
  }
  const [upper, lower] = a.bounds.y <= b.bounds.y ? [a, b] : [b, a];
  const across = overlapOn(a.bounds, b.bounds, "x");
  if (across < 0.5 * Math.min(a.bounds.width, b.bounds.width)) {
    return false;
  }
  const gap = lower.bounds.y - (upper.bounds.y + upper.bounds.height);
  return (
    gap >= -0.25 * Math.min(a.bounds.height, b.bounds.height) &&
    gap <=
      (resize.sy < resize.sx
        ? MAGIC_RESIZE_RULES.columnGapShorter
        : MAGIC_RESIZE_RULES.columnGap) *
        page.height
  );
};

// How far a small unit is from a text it sits beside (an icon before a
// label, a sticker on a title), or null when it doesn't: it's level with
// the text (they overlap by half the smaller height), within an em of it,
// and no bigger than a few lines of it, or than a small share of the page
const followDistance = (
  unit: Rigid,
  piece: TextPiece,
  page: Size
): number | null => {
  const { bounds } = unit;
  const text = piece.bounds;
  const { fontSize, lineHeight } = piece.element;
  const level = sharesRow(bounds, text);
  const gap = -overlapOn(bounds, text, "x");
  const most = MAGIC_RESIZE_RULES.followLines * fontSize * lineHeight;
  const small =
    Math.max(bounds.width, bounds.height) <=
    Math.min(
      most,
      MAGIC_RESIZE_RULES.followSize * Math.min(page.width, page.height)
    );
  return level && small && gap <= fontSize ? Math.max(0, gap) : null;
};

// Attaches each small unit beside a text to the nearest such text, and
// returns the ones left
const attachFollowers = (
  rigid: readonly Rigid[],
  texts: readonly TextPiece[],
  page: Size
): Rigid[] =>
  rigid.filter((unit) => {
    let nearest: TextPiece | null = null;
    let distance = Number.POSITIVE_INFINITY;
    for (const piece of texts) {
      const gap = followDistance(unit, piece, page);
      if (gap !== null && gap < distance) {
        nearest = piece;
        distance = gap;
      }
    }
    nearest?.followers.push(unit);
    return nearest === null;
  });

const boundsOfAll = (boxes: readonly Rect[]): Rect =>
  unionRect(boxes) ?? { height: 0, width: 0, x: 0, y: 0 };

const unitsOf = (
  document: DesignDocument,
  measure: MeasureText,
  resize: Resize
): Unit[] => {
  const page = resize.from;
  const sizes = new Map<string, TextSize>();
  for (const element of document.elements) {
    if (element.type === "text") {
      sizes.set(element.id, measure(element));
    }
  }
  const byId = new Map(
    document.elements.map((element) => [element.id, element])
  );
  const placed = (element: DesignElement): Placed => {
    const size = sizes.get(element.id);
    return {
      bounds: rotatedBounds(element, size && inkOf(size)),
      box: rotatedBounds(element, size),
      element,
    };
  };
  const rigidOf = (items: readonly Placed[]): Rigid => ({
    bounds: boundsOfAll(items.map((item) => item.bounds)),
    elements: items.map((item) => item.element),
    kind: "rigid",
  });

  const units: Unit[] = [];
  const rigid: Rigid[] = [];
  const texts: TextPiece[] = [];
  const loose: Placed[] = [];
  const ids = document.elements.map((element) => element.id);
  for (const unit of selectionUnits(document, ids)) {
    const items = unit.flatMap((id) => {
      const element = byId.get(id);
      return element ? [placed(element)] : [];
    });
    const [only] = items;
    if (items.length > 1 || !only) {
      rigid.push(rigidOf(items));
      continue;
    }
    const spans = {
      x: coverage(only.bounds, page, "x") >= MAGIC_RESIZE_RULES.span,
      y: coverage(only.bounds, page, "y") >= MAGIC_RESIZE_RULES.span,
    };
    if (isStructure(only.element, spans)) {
      units.push({ element: only.element, kind: "stretch", spans });
    } else {
      loose.push(only);
    }
  }
  for (const cluster of linkedSets(loose, (item, host) =>
    movesWith(item, host, page)
  )) {
    const [only] = cluster;
    if (cluster.length === 1 && only?.element.type === "text") {
      texts.push({
        bounds: only.bounds,
        element: only.element,
        followers: [],
        kind: "text",
        size: sizes.get(only.element.id) ?? only.bounds,
      });
    } else {
      rigid.push(rigidOf(cluster));
    }
  }
  const pieces: Piece[] = [...attachFollowers(rigid, texts, page), ...texts];
  for (const set of linkedSets(pieces, (a, b) => stacksOn(a, b, resize))) {
    if (set.some((piece) => piece.kind === "text")) {
      units.push({ kind: "column", pieces: set });
    } else {
      units.push(...(set as Rigid[]));
    }
  }
  return units;
};

// ---------------------------------------------------------------------------
// Laying out each kind of unit

const placeRigid = (
  elements: readonly DesignElement[],
  bounds: Rect,
  resize: Resize
): DesignElement[] => {
  const scale = fitScale(bounds, resize.lo, resize);
  const target = placeBox(
    bounds,
    { height: bounds.height * scale, width: bounds.width * scale },
    resize
  );
  return elements.map((element) =>
    scaleElementEvenly(element, scale, bounds, target)
  );
};

// A text at another size. Curved text scales its width with it, so its arc
// stays centred where it was; straight text keeps its wrap width.
const atSize = (text: TextElement, fontSize: number): TextElement => {
  const size = clamp(fontSize, 1, MAX_FONT_SIZE);
  return text.curve === 0
    ? { ...text, fontSize: size }
    : scaleElementEvenly(text, size / text.fontSize, text, text);
};

// The room text has on the new page, inside its margins
const roomOf = (resize: Resize): Size => ({
  height: resize.to.height - resize.margin * 2,
  width: resize.to.width - resize.margin * 2,
});

// The smallest a text may get to fit: a share of the shorter side, or the
// smaller ratio, but never above the larger ratio or where it started
const floorOf = (text: TextElement, start: number, resize: Resize): number =>
  Math.min(
    start,
    Math.max(
      text.fontSize * resize.lo,
      MAGIC_RESIZE_RULES.minFont * resize.shorter
    ),
    text.fontSize * resize.hi
  );

// The largest size in [low, high] that `fits`, or low when none does
const largestFitting = (
  low: number,
  high: number,
  fits: (value: number) => boolean
): number => {
  if (fits(high)) {
    return high;
  }
  let bottom = low;
  let top = high;
  for (let step = 0; step < FIT_STEPS; step += 1) {
    const middle = (bottom + top) / 2;
    if (fits(middle)) {
      bottom = middle;
    } else {
      top = middle;
    }
  }
  return bottom;
};

// A text's first size on the new page, and how small it may get. Curved
// text keeps its curve and doesn't re-wrap: it scales until its arc fits
// the margins. Straight text grows with the page's area but keeps its wrap
// width in proportion to the page's width, so it re-wraps into more lines
// where the page got narrower, and gets smaller rather than break a word it
// didn't break before.
const startText = (
  piece: TextPiece,
  scale: number,
  measure: MeasureText,
  resize: Resize
): { text: TextElement; floor: number } => {
  const { element, size } = piece;
  const room = roomOf(resize);
  if (element.curve !== 0) {
    let text = atSize(
      element,
      element.fontSize *
        Math.min(
          scale,
          room.width / Math.max(size.width, 1e-6),
          room.height / Math.max(size.height, 1e-6)
        )
    );
    // Glyphs don't scale quite linearly: check, and correct once
    const measured = measure(text);
    const over = Math.max(
      measured.width / room.width,
      measured.height / room.height
    );
    if (over > 1) {
      text = atSize(text, text.fontSize / over);
    }
    return { floor: floorOf(element, text.fontSize, resize), text };
  }
  const width = clampLength(
    resize.even
      ? element.width * scale
      : Math.min(element.width * resize.sx, room.width)
  );
  const start = { ...atSize(element, element.fontSize * scale), width };
  const floor = floorOf(element, start.fontSize, resize);
  if (resize.even || size.splitsWords) {
    return { floor, text: start };
  }
  const fontSize = largestFitting(
    floor,
    start.fontSize,
    (value) => !measure({ ...start, fontSize: value }).splitsWords
  );
  const text = atSize(start, fontSize);
  if (!measure(text).splitsWords || width >= room.width) {
    return { floor, text };
  }
  // Still breaking a word at its smallest: a wider box, up to the margins
  const wider = largestFitting(width, room.width, (value) =>
    Boolean(measure({ ...text, width: value }).splitsWords)
  );
  return { floor, text: { ...text, width: Math.min(room.width, wider + 1) } };
};

// Where a piece's new box (`box`) starts across the column, which is now
// `width` wide: by its nearest side or the middle of the column, as on the
// page
const acrossColumn = (
  piece: Piece,
  column: Rect,
  box: Size,
  width: number,
  resize: Resize
): number => {
  const { bounds } = piece;
  const before = bounds.x - column.x;
  switch (anchorOf(before, bounds.width, column.width)) {
    case "start": {
      return before * resize.lo;
    }
    case "end": {
      const after = column.x + column.width - (bounds.x + bounds.width);
      return width - after * resize.lo - box.width;
    }
    default: {
      const offset =
        bounds.x + bounds.width / 2 - (column.x + column.width / 2);
      return width / 2 + offset * resize.lo - box.width / 2;
    }
  }
};

// One piece of a column at its new size: its elements, the box they
// cover (from where they are), and how much it grew, which the gap above it
// grows by
interface SizedPiece {
  elements: DesignElement[];
  box: Rect;
  scale: number;
}

const sizeText = (
  text: TextElement,
  piece: TextPiece,
  measure: MeasureText
): SizedPiece => {
  const at = { ...text, x: 0, y: 0 };
  return {
    box: rotatedBounds(at, inkOf(measure(at))),
    elements: [at],
    scale: text.fontSize / piece.element.fontSize,
  };
};

const sizeRigid = (unit: Rigid, scale: number): SizedPiece => ({
  box: {
    height: unit.bounds.height * scale,
    width: unit.bounds.width * scale,
    x: 0,
    y: 0,
  },
  elements: unit.elements.map((element) =>
    scaleElementEvenly(element, scale, unit.bounds, { x: 0, y: 0 })
  ),
  scale,
});

const moveBy = <T extends DesignElement>(element: T, dx: number, dy: number) =>
  ({ ...element, x: element.x + dx, y: element.y + dy }) as T;

// The pieces before `index` (in top-to-bottom order) that it sits right
// under: they overlap it across, with nothing else between
const directlyAbove = (pieces: readonly Piece[], index: number): number[] => {
  const piece = pieces[index];
  if (!piece) {
    return [];
  }
  const above = pieces
    .slice(0, index)
    .flatMap((other, at) =>
      overlapOn(piece.bounds, other.bounds, "x") > 0 ? [at] : []
    );
  return above.filter((at) => {
    const bottom =
      (pieces[at]?.bounds.y ?? 0) + (pieces[at]?.bounds.height ?? 0);
    return !above.some(
      (other) => other !== at && (pieces[other]?.bounds.y ?? 0) >= bottom
    );
  });
};

interface ColumnLayout {
  // Each piece's elements, and what they cover, in the column's own space
  pieces: DesignElement[][];
  boxes: Rect[];
  // Around them all
  bounds: Rect;
}

// Lays the pieces out top to bottom: each starts below the ones above it
// that it overlaps across, by its old gap grown as much as it grew. Pieces
// side by side stay side by side.
const layColumn = (
  entries: readonly { piece: Piece; sized: SizedPiece }[],
  resize: Resize
): ColumnLayout => {
  const pieces = entries.map(({ piece }) => piece);
  const column = boundsOfAll(pieces.map((piece) => piece.bounds));
  const width = Math.max(
    column.width * resize.lo,
    ...entries.map(({ sized }) => sized.box.width)
  );
  const tops: number[] = [];
  const boxes: Rect[] = [];
  const placed = entries.map(({ piece, sized }, index) => {
    const { box, elements, scale } = sized;
    // Below what's right above it, level with what it shares a row with,
    // or where it was if neither
    const candidates = directlyAbove(pieces, index).map((above) => {
      const other = pieces[above]?.bounds ?? piece.bounds;
      const gap = piece.bounds.y - (other.y + other.height);
      return (tops[above] ?? 0) + (boxes[above]?.height ?? 0) + gap * scale;
    });
    for (const [before, other] of pieces.slice(0, index).entries()) {
      if (sharesRow(piece.bounds, other.bounds)) {
        candidates.push(
          (tops[before] ?? 0) + (piece.bounds.y - other.bounds.y) * scale
        );
      }
    }
    const top =
      candidates.length > 0
        ? Math.max(...candidates)
        : (piece.bounds.y - column.y) * resize.lo;
    const left = acrossColumn(piece, column, box, width, resize);
    tops.push(top);
    boxes.push({ ...box, x: left, y: top });
    return elements.map((element) =>
      moveBy(element, left - box.x, top - box.y)
    );
  });
  return { bounds: boundsOfAll(boxes), boxes, pieces: placed };
};

// What sits beside a text follows it, scaled with its type: by the side
// of the text's lines it was on, level with its top
const placeFollowers = (
  piece: TextPiece,
  text: TextElement,
  box: Rect
): { elements: DesignElement[]; boxes: Rect[] } => {
  const scale = text.fontSize / piece.element.fontSize;
  const old = piece.bounds;
  const placed = piece.followers.map((unit) => {
    const before =
      unit.bounds.x + unit.bounds.width / 2 < old.x + old.width / 2;
    const from = { x: before ? old.x : old.x + old.width, y: old.y };
    const to = { x: before ? box.x : box.x + box.width, y: box.y };
    return {
      box: {
        height: unit.bounds.height * scale,
        width: unit.bounds.width * scale,
        x: to.x + (unit.bounds.x - from.x) * scale,
        y: to.y + (unit.bounds.y - from.y) * scale,
      },
      elements: unit.elements.map((element) =>
        scaleElementEvenly(element, scale, from, to)
      ),
    };
  });
  return {
    boxes: placed.map((item) => item.box),
    elements: placed.flatMap((item) => item.elements),
  };
};

// A column: each text sized on its own and everything else by the smaller
// ratio, then all of it made smaller together if the column is too tall
// for the page, and the column placed like any other unit
const placeColumn = (
  column: Column,
  measure: MeasureText,
  resize: Resize
): DesignElement[] => {
  const pieces = column.pieces.toSorted((a, b) => a.bounds.y - b.bounds.y);
  const scale = clamp(resize.mid, resize.lo, resize.hi);
  const starts = new Map(
    pieces.flatMap((piece) =>
      piece.kind === "text"
        ? [[piece, startText(piece, scale, measure, resize)] as const]
        : []
    )
  );
  const layout = (factor: number) =>
    layColumn(
      pieces.map((piece) => {
        if (piece.kind === "rigid") {
          return { piece, sized: sizeRigid(piece, resize.lo * factor) };
        }
        const { floor, text } = starts.get(piece) ?? {
          floor: piece.element.fontSize,
          text: piece.element,
        };
        const fontSize = Math.max(floor, text.fontSize * factor);
        return {
          piece,
          sized: sizeText(atSize(text, fontSize), piece, measure),
        };
      }),
      resize
    );
  const room = roomOf(resize);
  let laid = layout(1);
  if (!resize.even && laid.bounds.height > room.height) {
    const lowest = Math.min(
      ...[...starts.values()].map(({ floor, text }) => floor / text.fontSize)
    );
    laid = layout(
      largestFitting(
        lowest,
        1,
        (factor) => layout(factor).bounds.height <= room.height
      )
    );
  }

  const followers = pieces.map((piece, index) => {
    const [text] = laid.pieces[index] ?? [];
    const box = laid.boxes[index];
    return piece.kind === "text" && text?.type === "text" && box
      ? placeFollowers(piece, text, box)
      : { boxes: [], elements: [] };
  });
  let elements: DesignElement[] = [
    ...laid.pieces.flat(),
    ...followers.flatMap((placed) => placed.elements),
  ];
  let bounds = boundsOfAll([
    laid.bounds,
    ...followers.flatMap((placed) => placed.boxes),
  ]);
  const old = boundsOfAll(
    pieces.flatMap((piece) => [
      piece.bounds,
      ...(piece.kind === "text"
        ? piece.followers.map((unit) => unit.bounds)
        : []),
    ])
  );
  // Still too big for a page it was on: smaller, without re-wrapping
  const fit = isOnPage(old, resize.from)
    ? Math.min(
        1,
        resize.to.width / bounds.width,
        resize.to.height / bounds.height
      )
    : 1;
  if (fit < 1) {
    elements = elements.map((element) =>
      scaleElementEvenly(element, fit, bounds, bounds)
    );
    bounds = {
      ...bounds,
      height: bounds.height * fit,
      width: bounds.width * fit,
    };
  }
  const target = placeBox(old, bounds, resize, resize.margin);
  return elements.map((element) =>
    moveBy(element, target.x - bounds.x, target.y - bounds.y)
  );
};

// A turned element that spans the page keeps its turn: its centre moves
// with the page, and it grows by the larger ratio so it still covers it,
// or (a stripe across one axis) its side along that axis grows with it
const stretchTurned = (
  element: DesignElement & Size,
  spans: Record<Axis, boolean>,
  resize: Resize
): DesignElement => {
  const radians = (element.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const turn = (x: number, y: number): Point => ({
    x: x * cos - y * sin,
    y: x * sin + y * cos,
  });
  const half = turn(element.width / 2, element.height / 2);
  const center = {
    x: (element.x + half.x) * resize.sx,
    y: (element.y + half.y) * resize.sy,
  };
  let size = {
    height: element.height * resize.hi,
    width: element.width * resize.hi,
  };
  if (!(spans.x && spans.y)) {
    // The side closer to the spanning axis follows it
    const axis: Axis = spans.x ? "x" : "y";
    const widthAlong = axis === "x" ? Math.abs(cos) : Math.abs(sin);
    const heightAlong = axis === "x" ? Math.abs(sin) : Math.abs(cos);
    const along = ratioOf(resize, axis);
    size =
      widthAlong >= heightAlong
        ? { height: element.height * resize.lo, width: element.width * along }
        : { height: element.height * along, width: element.width * resize.lo };
  }
  const corner = turn(size.width / 2, size.height / 2);
  return withBox(
    element,
    { ...size, x: center.x - corner.x, y: center.y - corner.y },
    resize
  );
};

// A divider stretches along the axes it spans; across the others it stays
// by its nearest edge or the centre, like everything else
const stretchLine = (
  line: LinearElement,
  spans: Record<Axis, boolean>,
  resize: Resize
): LinearElement => {
  const bounds = rotatedBounds(line);
  const mapper = (axis: Axis) => {
    if (spans[axis]) {
      const ratio = ratioOf(resize, axis);
      return (value: number) => value * ratio;
    }
    const { start } = spanOf(bounds, axis);
    const nextStart = placeOnAxis(
      bounds,
      axis,
      lengthOf(bounds, axis) * resize.lo,
      resize
    );
    return (value: number) => nextStart + (value - start) * resize.lo;
  };
  const mapX = mapper("x");
  const mapY = mapper("y");
  const [x1, y1, x2, y2] = line.points;
  const x = mapX(line.x);
  const y = mapY(line.y);
  return {
    ...line,
    points: [
      mapX(line.x + x1) - x,
      mapY(line.y + y1) - y,
      mapX(line.x + x2) - x,
      mapY(line.y + y2) - y,
    ],
    strokeWidth: scaleLineStroke(line.strokeWidth, resize.lo),
    x,
    y,
  };
};

const placeStretch = (
  element: DesignElement,
  spans: Record<Axis, boolean>,
  resize: Resize
): DesignElement => {
  if (isLinear(element)) {
    return stretchLine(element, spans, resize);
  }
  if (element.type === "text" || element.type === "graphic") {
    return element;
  }
  if (element.rotation !== 0) {
    return stretchTurned(element, spans, resize);
  }
  return withBox(
    element,
    {
      height: element.height * resize.sy,
      width: element.width * resize.sx,
      x: element.x * resize.sx,
      y: element.y * resize.sy,
    },
    resize
  );
};

const resizeOf = (from: Size, to: Size): Resize => {
  const sx = to.width / from.width;
  const sy = to.height / from.height;
  const shorter = Math.min(to.width, to.height);
  return {
    even: Math.abs(sx / sy - 1) < MAGIC_RESIZE_RULES.sameShape,
    from,
    hi: Math.max(sx, sy),
    lo: Math.min(sx, sy),
    margin: MAGIC_RESIZE_RULES.margin * shorter,
    mid: Math.sqrt(sx * sy),
    shorter,
    sx,
    sy,
    to,
  };
};

// The design laid out again at `to`. `measure` gives a text's box as the
// browser draws it, so fonts must have loaded first.
export const magicResize = (
  document: DesignDocument,
  to: Size,
  measure: MeasureText
): DesignDocument => {
  if (to.width === document.width && to.height === document.height) {
    return document;
  }
  const resize = resizeOf(document, to);
  const placed = new Map<string, DesignElement>();
  const units = unitsOf(document, measure, resize);
  for (const unit of units) {
    let elements: DesignElement[];
    if (unit.kind === "rigid") {
      elements = placeRigid(unit.elements, unit.bounds, resize);
    } else if (unit.kind === "column") {
      elements = placeColumn(unit, measure, resize);
    } else {
      elements = [placeStretch(unit.element, unit.spans, resize)];
    }
    for (const element of elements) {
      placed.set(element.id, element);
    }
  }
  return {
    ...document,
    elements: document.elements.map(
      (element) => placed.get(element.id) ?? element
    ),
    height: to.height,
    width: to.width,
  };
};

// How a page of another size is filled: laid out again (Magic), stretched
// to it, or left where it was
export const RESIZE_LAYOUTS = ["magic", "stretch", "keep"] as const;
export type ResizeLayout = (typeof RESIZE_LAYOUTS)[number];

export const resizeWithLayout = (
  document: DesignDocument,
  to: Size,
  layout: ResizeLayout,
  measure: MeasureText
): DesignDocument =>
  layout === "magic"
    ? magicResize(document, to, measure)
    : resizeDocument(document, to, layout === "stretch");
