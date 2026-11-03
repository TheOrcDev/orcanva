// Turns an SVG file into the art a graphic element carries: every shape a
// path with transforms applied, paint resolved through inheritance into
// palette entries, coordinates rounded to two decimals. Anything the canvas
// can't draw from flat paths (gradients, masks, clip paths, filters, <use>,
// text, images) is refused rather than drawn wrong. Runs at build time
// (scripts/build-graphics.ts), never in the browser.
import { optimize } from "svgo";
import type { XastChild, XastElement, XastRoot } from "svgo";
import svgpath from "svgpath";

import { MAX_GRAPHIC_PATH_LENGTH } from "@/lib/document/schema";
import type { GraphicLayer } from "@/lib/document/schema";
import type { GraphicArt } from "@/lib/graphics/entry";

export class UnsupportedSvgError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "UnsupportedSvgError";
  }
}

const refuse = (reason: string): never => {
  throw new UnsupportedSvgError(reason);
};

export interface NormalizeOptions {
  // What currentColor paints when the file doesn't set a colour
  currentColor: string;
  // Decimals kept in path data
  precision?: number;
}

const MAX_PALETTE = 16;
const MAX_LAYERS = 200;
const DEFAULT_PRECISION = 2;

// Elements that need more than flat paths, and their reason
const REFUSED_ELEMENTS: Record<string, string> = {
  clipPath: "clip paths",
  feBlend: "filters",
  filter: "filters",
  foreignObject: "foreign objects",
  image: "images",
  linearGradient: "gradients",
  marker: "markers",
  mask: "masks",
  pattern: "patterns",
  radialGradient: "gradients",
  script: "scripts",
  style: "style sheets",
  switch: "switch",
  symbol: "symbols",
  text: "text",
  textPath: "text",
  use: "use",
};
const SHAPES = new Set([
  "circle",
  "ellipse",
  "line",
  "path",
  "polygon",
  "polyline",
  "rect",
]);
const IGNORED = new Set(["defs", "desc", "metadata", "title"]);
const REFUSED_ATTRIBUTES: Record<string, string> = {
  "clip-path": "clip paths",
  filter: "filters",
  mask: "masks",
  "stroke-dasharray": "dashed strokes",
};

const NAMED_COLORS: Record<string, string> = {
  black: "#000000",
  blue: "#0000ff",
  gray: "#808080",
  green: "#008000",
  grey: "#808080",
  orange: "#ffa500",
  purple: "#800080",
  red: "#ff0000",
  white: "#ffffff",
  yellow: "#ffff00",
};

type FillRule = GraphicLayer["fillRule"];
type LineCap = GraphicLayer["lineCap"];
type LineJoin = GraphicLayer["lineJoin"];

// What a shape inherits from its ancestors
interface Inherited {
  color: string | null;
  fill: string;
  fillOpacity: number;
  fillRule: FillRule;
  lineCap: LineCap;
  lineJoin: LineJoin;
  stroke: string;
  strokeOpacity: number;
  strokeWidth: number;
  visible: boolean;
}

// Per element, not inherited: they multiply down the tree
interface Context {
  inherited: Inherited;
  matrix: Matrix;
  opacity: number;
}

type Matrix = [number, number, number, number, number, number];
const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0];

const multiply = (m: Matrix, n: Matrix): Matrix => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];

const UNIT = /px$/u;
const NUMBER = /[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/giu;
const TRANSFORM =
  /(?<name>matrix|translate|scale|rotate|skewX|skewY)\s*\((?<args>[^)]*)\)/gu;

const numbersIn = (text: string): number[] =>
  (text.match(NUMBER) ?? []).map(Number);

const degrees = (value: number) => (value * Math.PI) / 180;

const transformMatrix = (name: string, args: number[]): Matrix => {
  const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = args;
  switch (name) {
    case "matrix": {
      return [a, b, c, d, e, f];
    }
    case "translate": {
      return [1, 0, 0, 1, a, args.length > 1 ? b : 0];
    }
    case "scale": {
      return [a, 0, 0, args.length > 1 ? b : a, 0, 0];
    }
    case "rotate": {
      const cos = Math.cos(degrees(a));
      const sin = Math.sin(degrees(a));
      const turn: Matrix = [cos, sin, -sin, cos, 0, 0];
      return args.length > 1
        ? multiply(multiply([1, 0, 0, 1, b, c], turn), [1, 0, 0, 1, -b, -c])
        : turn;
    }
    case "skewX": {
      return [1, 0, Math.tan(degrees(a)), 1, 0, 0];
    }
    default: {
      return [1, Math.tan(degrees(a)), 0, 1, 0, 0];
    }
  }
};

export const parseTransform = (value: string): Matrix => {
  let matrix = IDENTITY;
  for (const match of value.matchAll(TRANSFORM)) {
    const { args = "", name = "" } = match.groups ?? {};
    matrix = multiply(matrix, transformMatrix(name, numbersIn(args)));
  }
  return matrix;
};

const length = (value: string | undefined, fallback = 0): number => {
  if (value === undefined) {
    return fallback;
  }
  if (value.trim().endsWith("%")) {
    return refuse("percentage lengths");
  }
  const parsed = Number(value.trim().replace(UNIT, ""));
  return Number.isFinite(parsed) ? parsed : fallback;
};

const HEX = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/iu;
const RGB = /^rgba?\((?<channels>[^)]*)\)$/iu;

const hexByte = (value: number) =>
  Math.round(Math.min(255, Math.max(0, value)))
    .toString(16)
    .padStart(2, "0");

// A colour as lowercase #rrggbb (#rrggbbaa when see-through)
const normalColor = (value: string): string => {
  const lower = value.trim().toLowerCase();
  if (HEX.test(lower)) {
    const digits = lower.slice(1);
    return digits.length <= 4
      ? `#${[...digits].map((digit) => digit + digit).join("")}`
      : lower;
  }
  const rgb = RGB.exec(lower);
  if (rgb) {
    const [r = 0, g = 0, b = 0, alpha = 1] = numbersIn(
      rgb.groups?.channels ?? ""
    );
    const opaque = `#${hexByte(r)}${hexByte(g)}${hexByte(b)}`;
    return alpha < 1 ? `${opaque}${hexByte(alpha * 255)}` : opaque;
  }
  return NAMED_COLORS[lower] ?? refuse(`the colour "${value}"`);
};

// A paint as a colour, or null for none
const resolvePaint = (
  paint: string,
  inherited: Inherited,
  options: NormalizeOptions
): string | null => {
  const value = paint.trim();
  if (value === "none" || value === "transparent") {
    return null;
  }
  if (value.startsWith("url(")) {
    return refuse("paint servers (gradients or patterns)");
  }
  if (value.toLowerCase() === "currentcolor") {
    return normalColor(inherited.color ?? options.currentColor);
  }
  return normalColor(value);
};

// style="a: b; c: d" wins over the attributes
const attributesOf = (element: XastElement): Record<string, string> => {
  const attributes = { ...element.attributes };
  for (const declaration of (attributes.style ?? "").split(";")) {
    const colon = declaration.indexOf(":");
    if (colon > 0) {
      attributes[declaration.slice(0, colon).trim()] = declaration
        .slice(colon + 1)
        .trim();
    }
  }
  return attributes;
};

const opacityOf = (value: string | undefined): number =>
  value === undefined ? 1 : Math.min(1, Math.max(0, length(value, 1)));

const oneOf = <T extends string>(
  value: string | undefined,
  allowed: readonly T[],
  fallback: T
): T => allowed.find((option) => option === value?.trim()) ?? fallback;

const inherit = (
  parent: Inherited,
  attributes: Record<string, string>
): Inherited => ({
  color: attributes.color ?? parent.color,
  fill: attributes.fill ?? parent.fill,
  fillOpacity:
    attributes["fill-opacity"] === undefined
      ? parent.fillOpacity
      : opacityOf(attributes["fill-opacity"]),
  fillRule: oneOf(
    attributes["fill-rule"],
    ["nonzero", "evenodd"],
    parent.fillRule
  ),
  lineCap: oneOf(
    attributes["stroke-linecap"],
    ["butt", "round", "square"],
    parent.lineCap
  ),
  lineJoin: oneOf(
    attributes["stroke-linejoin"],
    ["miter", "round", "bevel"],
    parent.lineJoin
  ),
  stroke: attributes.stroke ?? parent.stroke,
  strokeOpacity:
    attributes["stroke-opacity"] === undefined
      ? parent.strokeOpacity
      : opacityOf(attributes["stroke-opacity"]),
  strokeWidth:
    attributes["stroke-width"] === undefined
      ? parent.strokeWidth
      : length(attributes["stroke-width"], parent.strokeWidth),
  visible:
    attributes.visibility === undefined
      ? parent.visible
      : attributes.visibility !== "hidden" &&
        attributes.visibility !== "collapse",
});

const ellipsePath = (cx: number, cy: number, rx: number, ry: number) =>
  `M${cx - rx} ${cy}A${rx} ${ry} 0 1 0 ${cx + rx} ${cy}A${rx} ${ry} 0 1 0 ${cx - rx} ${cy}Z`;

const pointsPath = (value: string | undefined, close: boolean) => {
  const numbers = numbersIn(value ?? "");
  const pairs: string[] = [];
  for (let index = 0; index + 1 < numbers.length; index += 2) {
    pairs.push(`${numbers[index]} ${numbers[index + 1]}`);
  }
  return pairs.length < 2 ? "" : `M${pairs.join("L")}${close ? "Z" : ""}`;
};

const rectPath = (attributes: Record<string, string>) => {
  const x = length(attributes.x);
  const y = length(attributes.y);
  const width = length(attributes.width);
  const height = length(attributes.height);
  if (width <= 0 || height <= 0) {
    return "";
  }
  // A missing rx or ry takes the other's value; both are capped at half
  let rx = attributes.rx === undefined ? undefined : length(attributes.rx);
  let ry = attributes.ry === undefined ? undefined : length(attributes.ry);
  rx = Math.min(width / 2, rx ?? ry ?? 0);
  ry = Math.min(height / 2, ry ?? rx);
  if (rx <= 0 || ry <= 0) {
    return `M${x} ${y}H${x + width}V${y + height}H${x}Z`;
  }
  return [
    `M${x + rx} ${y}H${x + width - rx}`,
    `A${rx} ${ry} 0 0 1 ${x + width} ${y + ry}V${y + height - ry}`,
    `A${rx} ${ry} 0 0 1 ${x + width - rx} ${y + height}H${x + rx}`,
    `A${rx} ${ry} 0 0 1 ${x} ${y + height - ry}V${y + ry}`,
    `A${rx} ${ry} 0 0 1 ${x + rx} ${y}Z`,
  ].join("");
};

// Path data for any basic shape, untransformed; empty when it draws nothing
const shapePath = (name: string, attributes: Record<string, string>) => {
  switch (name) {
    case "path": {
      return attributes.d ?? "";
    }
    case "rect": {
      return rectPath(attributes);
    }
    case "circle": {
      const r = length(attributes.r);
      return r > 0
        ? ellipsePath(length(attributes.cx), length(attributes.cy), r, r)
        : "";
    }
    case "ellipse": {
      const rx = length(attributes.rx);
      const ry = length(attributes.ry);
      return rx > 0 && ry > 0
        ? ellipsePath(length(attributes.cx), length(attributes.cy), rx, ry)
        : "";
    }
    case "line": {
      return `M${length(attributes.x1)} ${length(attributes.y1)}L${length(attributes.x2)} ${length(attributes.y2)}`;
    }
    case "polyline": {
      return pointsPath(attributes.points, false);
    }
    default: {
      return pointsPath(attributes.points, true);
    }
  }
};

const LEADING_ZERO = /^(?<sign>-?)0\./u;

// The shortest text for a number at the given precision: no leading zero,
// no trailing zeros
const compactNumber = (value: number, precision: number): string => {
  const text = Number(value.toFixed(precision)).toString();
  if (text === "-0") {
    return "0";
  }
  return text.replace(LEADING_ZERO, "$<sign>.");
};

// Whether a number written straight after another needs a space between
const needsSpace = (previous: string | null, next: string) =>
  previous !== null &&
  !next.startsWith("-") &&
  !(next.startsWith(".") && previous.includes("."));

// Path data with as few characters as SVG allows: a command letter only
// where it changes (a repeated moveto would mean lineto, so it stays), and
// a separator only where a number would otherwise run into the last
const compactPath = (path: ReturnType<typeof svgpath>, precision: number) => {
  let out = "";
  let lastCommand = "";
  let previous: string | null = null;
  path.iterate((segment) => {
    const [command, ...values] = segment;
    const repeats =
      command === lastCommand &&
      command.toLowerCase() !== "m" &&
      values.length > 0;
    if (!repeats) {
      out += command;
      previous = null;
    }
    lastCommand = command;
    for (const value of values) {
      // svgpath can hand back a number it parsed as a string
      const text = compactNumber(Number(value), precision);
      out += needsSpace(previous, text) ? ` ${text}` : text;
      previous = text;
    }
  });
  return out;
};

const transformedPath = (
  d: string,
  matrix: Matrix,
  precision: number
): string => {
  const path = svgpath(d);
  const parseError = (path as unknown as { err?: string }).err;
  if (parseError) {
    return refuse(`path data (${parseError})`);
  }
  const placed = matrix === IDENTITY ? path : path.matrix(matrix);
  return compactPath(placed.rel().round(precision), precision);
};

// How much a transform scales a stroke's width
const strokeScaleOf = (matrix: Matrix): number =>
  Math.sqrt(Math.abs(matrix[0] * matrix[3] - matrix[1] * matrix[2]));

const round = (value: number, precision: number) =>
  Number(value.toFixed(precision));

interface Collected {
  palette: string[];
  layers: GraphicLayer[];
}

const paletteIndexOf = (collected: Collected, color: string): number => {
  const known = collected.palette.indexOf(color);
  if (known !== -1) {
    return known;
  }
  if (collected.palette.length >= MAX_PALETTE) {
    return refuse(`more than ${MAX_PALETTE} colours`);
  }
  collected.palette.push(color);
  return collected.palette.length - 1;
};

const addShape = (
  collected: Collected,
  element: XastElement,
  context: Context,
  options: NormalizeOptions
) => {
  const { inherited, matrix, opacity } = context;
  const precision = options.precision ?? DEFAULT_PRECISION;
  const raw = shapePath(element.name, attributesOf(element));
  if (!inherited.visible || opacity <= 0 || raw.trim() === "") {
    return;
  }
  const fill = resolvePaint(inherited.fill, inherited, options);
  const stroke =
    inherited.strokeWidth > 0
      ? resolvePaint(inherited.stroke, inherited, options)
      : null;
  if (fill === null && stroke === null) {
    return;
  }
  const d = transformedPath(raw, matrix, precision);
  const strokeWidth = round(
    inherited.strokeWidth * strokeScaleOf(matrix),
    precision
  );
  const base = {
    d,
    fillRule: inherited.fillRule,
    lineCap: inherited.lineCap,
    lineJoin: inherited.lineJoin,
  };
  const fillOpacity = round(opacity * inherited.fillOpacity, 3);
  const strokeOpacity = round(opacity * inherited.strokeOpacity, 3);
  const fillIndex = fill === null ? null : paletteIndexOf(collected, fill);
  const strokeIndex =
    stroke === null ? null : paletteIndexOf(collected, stroke);
  // A fill and a stroke at different opacities can't share a layer
  if (
    fillIndex !== null &&
    strokeIndex !== null &&
    fillOpacity !== strokeOpacity
  ) {
    collected.layers.push(
      {
        ...base,
        fill: fillIndex,
        opacity: fillOpacity,
        stroke: null,
        strokeWidth: 0,
      },
      {
        ...base,
        fill: null,
        opacity: strokeOpacity,
        stroke: strokeIndex,
        strokeWidth,
      }
    );
    return;
  }
  collected.layers.push({
    ...base,
    fill: fillIndex,
    opacity: fillIndex === null ? strokeOpacity : fillOpacity,
    stroke: strokeIndex,
    strokeWidth: strokeIndex === null ? 0 : strokeWidth,
  });
};

const checkAttributes = (attributes: Record<string, string>) => {
  for (const [name, reason] of Object.entries(REFUSED_ATTRIBUTES)) {
    const value = attributes[name];
    if (value !== undefined && value !== "none") {
      refuse(reason);
    }
  }
};

const walk = (
  collected: Collected,
  children: XastChild[],
  parent: Context,
  options: NormalizeOptions
) => {
  for (const child of children) {
    if (child.type !== "element") {
      continue;
    }
    const refused = REFUSED_ELEMENTS[child.name];
    if (refused) {
      refuse(refused);
    }
    if (IGNORED.has(child.name)) {
      // Anything refused hiding in <defs> is refused above when reached
      walk(collected, child.children, parent, options);
      continue;
    }
    const attributes = attributesOf(child);
    checkAttributes(attributes);
    if (attributes.display === "none") {
      continue;
    }
    const context: Context = {
      inherited: inherit(parent.inherited, attributes),
      matrix: attributes.transform
        ? multiply(parent.matrix, parseTransform(attributes.transform))
        : parent.matrix,
      opacity: parent.opacity * opacityOf(attributes.opacity),
    };
    if (child.name === "g") {
      walk(collected, child.children, context, options);
    } else if (SHAPES.has(child.name)) {
      addShape(collected, child, context, options);
    } else {
      refuse(`<${child.name}>`);
    }
  }
};

// Shapes inside <defs> only draw through <use>, which is refused; skip them
const withoutDefShapes = (children: XastChild[]): XastChild[] =>
  children.map((child) =>
    child.type === "element" && child.name === "defs"
      ? {
          ...child,
          children: child.children.filter(
            (inner) => inner.type !== "element" || !SHAPES.has(inner.name)
          ),
        }
      : child
  );

const parseSvg = (svg: string): XastRoot => {
  let root: XastRoot | null = null;
  try {
    optimize(svg, {
      plugins: [
        {
          fn: (tree) => {
            root = tree;
          },
          name: "capture-tree",
        },
      ],
    });
  } catch (error) {
    return refuse(
      `unreadable SVG (${error instanceof Error ? error.message : "parse error"})`
    );
  }
  return root ?? refuse("unreadable SVG");
};

const viewBoxOf = (attributes: Record<string, string>) => {
  const numbers = numbersIn(attributes.viewBox ?? "");
  if (numbers.length === 4) {
    const [x = 0, y = 0, width = 0, height = 0] = numbers;
    if (width > 0 && height > 0) {
      return [x, y, width, height] as [number, number, number, number];
    }
  }
  const width = length(attributes.width);
  const height = length(attributes.height);
  return width > 0 && height > 0
    ? ([0, 0, width, height] as [number, number, number, number])
    : refuse("no size (viewBox, width or height)");
};

const sameStroke = (a: GraphicLayer, b: GraphicLayer) =>
  a.fill === null &&
  b.fill === null &&
  a.stroke === b.stroke &&
  a.strokeWidth === b.strokeWidth &&
  a.lineCap === b.lineCap &&
  a.lineJoin === b.lineJoin &&
  a.opacity === b.opacity &&
  a.opacity === 1;

// Neighbouring outlines in the same paint become one layer (Tabler draws an
// icon in several); fills stay apart, since joining them can change how
// overlapping parts wind
const mergeStrokes = (layers: GraphicLayer[]): GraphicLayer[] => {
  const merged: GraphicLayer[] = [];
  for (const layer of layers) {
    const last = merged.at(-1);
    if (last && sameStroke(last, layer)) {
      merged[merged.length - 1] = { ...last, d: `${last.d}${layer.d}` };
    } else {
      merged.push(layer);
    }
  }
  return merged;
};

const INITIAL: Inherited = {
  color: null,
  fill: "black",
  fillOpacity: 1,
  fillRule: "nonzero",
  lineCap: "butt",
  lineJoin: "miter",
  stroke: "none",
  strokeOpacity: 1,
  strokeWidth: 1,
  visible: true,
};

export const normalizeSvg = (
  svg: string,
  options: NormalizeOptions
): GraphicArt => {
  const root = parseSvg(svg);
  const top = root.children.find(
    (child): child is XastElement =>
      child.type === "element" && child.name === "svg"
  );
  if (!top) {
    return refuse("no <svg> element");
  }
  const attributes = attributesOf(top);
  checkAttributes(attributes);
  const viewBox = viewBoxOf(attributes);
  const collected: Collected = { layers: [], palette: [] };
  walk(
    collected,
    withoutDefShapes(top.children),
    {
      inherited: inherit(INITIAL, attributes),
      matrix: IDENTITY,
      opacity: opacityOf(attributes.opacity),
    },
    options
  );
  const layers = mergeStrokes(collected.layers);
  if (layers.length === 0) {
    return refuse("nothing to draw");
  }
  if (layers.length > MAX_LAYERS) {
    return refuse(`more than ${MAX_LAYERS} layers`);
  }
  if (layers.some((layer) => layer.d.length > MAX_GRAPHIC_PATH_LENGTH)) {
    return refuse("a path too long to keep");
  }
  // Keep only the colours the merged layers use, in their order
  return { layers, palette: collected.palette, viewBox };
};
