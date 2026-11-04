// Turns an agent's friendly element specs ("white Anton text at the top")
// into full Orcanva elements, built on the editor's own factories and
// validated by the document schema, so whatever an agent writes is
// something the editor can open. Shared by the MCP server (mcp/) and the
// editor's WebMCP tools. Pure: no database, no files, no DOM.
import { z } from "zod";

import {
  createBoxElement,
  createGraphicElement,
  createImageElement,
  createLinearElement,
  createTextElement,
} from "@/lib/document/factories";
import type { Size } from "@/lib/document/geometry";
import { elementSchema, keepUnknownFields } from "@/lib/document/schema";
import type {
  Background,
  DesignElement,
  TextElement,
} from "@/lib/document/schema";
import { findFont } from "@/lib/fonts/catalog";
import type { GraphicEntry } from "@/lib/graphics/entry";

// Where an element goes when the agent gives a keyword instead of x/y
export const PLACEMENTS = [
  "center",
  "top",
  "bottom",
  "left",
  "right",
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
] as const;
export type Placement = (typeof PLACEMENTS)[number];

// Keyword placements keep this share of the page's shorter side as margin
const PLACEMENT_MARGIN = 0.05;
// Average glyph width in em, for estimating how text wraps. Display fonts
// run narrower and body fonts wider; Konva measures the real thing.
const AVERAGE_GLYPH_EM = 0.55;
// Text boxes default to this share of the page's width
const TEXT_WIDTH_RATIO = 0.8;

const color = z
  .string()
  .min(1)
  .max(64)
  .describe("CSS colour: #rrggbb, #rrggbbaa, rgb()/rgba() or a name");

const placement = {
  opacity: z.number().min(0).max(1).optional(),
  place: z
    .enum(PLACEMENTS)
    .optional()
    .describe(
      "Snap to a spot on the page (with a small margin) instead of giving x/y"
    ),
  rotation: z.number().optional().describe("Degrees, clockwise"),
  x: z.number().optional().describe("Left edge in page pixels"),
  y: z.number().optional().describe("Top edge in page pixels"),
};

const advanced = z
  .record(z.string(), z.unknown())
  .optional()
  .describe(
    "Raw Orcanva element fields to set as-is (e.g. effect, curve, fillGradient, marks, outline, glow). Use get_design to see field names."
  );

export const textSpec = z.object({
  ...placement,
  advanced,
  align: z.enum(["left", "center", "right"]).optional(),
  color: color.optional().describe("Text fill. Default #111111"),
  font: z
    .string()
    .optional()
    .describe("Font id from list_fonts. Default anton"),
  fontSize: z
    .number()
    .min(1)
    .max(4000)
    .optional()
    .describe("Pixels. Default 14% of page height"),
  highlight: z
    .object({ color, padding: z.number().min(0).max(2).optional() })
    .optional()
    .describe("A coloured box behind the text"),
  italic: z.boolean().optional(),
  letterSpacing: z.number().min(-0.5).max(2).optional().describe("In em"),
  lineHeight: z.number().min(0.5).max(4).optional(),
  name: z.string().max(120).optional(),
  outline: z
    .object({ color, width: z.number().min(0).max(1).optional() })
    .optional()
    .describe("Stroke around letters; width in em (0.05 is bold)"),
  shadow: z
    .object({
      blur: z.number().min(0).max(2).optional(),
      color: color.optional(),
      offsetX: z.number().min(-10).max(10).optional(),
      offsetY: z.number().min(-10).max(10).optional(),
    })
    .optional()
    .describe("Drop shadow; sizes in em"),
  text: z.string().min(1).max(5000),
  type: z.literal("text"),
  uppercase: z.boolean().optional(),
  weight: z.number().int().min(100).max(900).optional(),
  width: z
    .number()
    .positive()
    .optional()
    .describe("Wrap width in pixels. Default 80% of the page"),
});

export const boxSpec = z.object({
  ...placement,
  advanced,
  cornerRadius: z.number().min(0).optional(),
  fill: color.optional(),
  height: z.number().positive().optional(),
  name: z.string().max(120).optional(),
  stroke: color.optional(),
  strokeWidth: z.number().min(0).max(500).optional(),
  type: z.enum(["rect", "ellipse"]),
  width: z.number().positive().optional(),
});

export const lineSpec = z.object({
  advanced,
  color: color.optional(),
  name: z.string().max(120).optional(),
  opacity: z.number().min(0).max(1).optional(),
  strokeWidth: z.number().positive().max(500).optional(),
  type: z.enum(["line", "arrow"]),
  x1: z.number(),
  x2: z.number(),
  y1: z.number(),
  y2: z.number(),
});

export const graphicSpec = z.object({
  ...placement,
  advanced,
  colors: z
    .array(color)
    .max(16)
    .optional()
    .describe("Replace the graphic's palette, in order"),
  graphic: z
    .string()
    .min(1)
    .describe(
      "A graphic id from search_graphics (e.g. tabler:flame), or words to search for and take the best match"
    ),
  name: z.string().max(120).optional(),
  size: z
    .number()
    .positive()
    .optional()
    .describe("Longer side in pixels. Default a quarter of the page"),
  type: z.literal("graphic"),
});

export const imageSpec = z.object({
  ...placement,
  advanced,
  cornerRadius: z.number().min(0).optional(),
  height: z.number().positive().optional(),
  name: z.string().max(120).optional(),
  source: z
    .string()
    .min(1)
    .describe(
      "An http(s) URL of a PNG/JPG/WebP/GIF (the local MCP server also takes an absolute file path)"
    ),
  type: z.literal("image"),
  width: z
    .number()
    .positive()
    .optional()
    .describe("Give width or height; the other keeps the photo's aspect"),
});

export const elementSpec = z.discriminatedUnion("type", [
  textSpec,
  boxSpec,
  lineSpec,
  graphicSpec,
  imageSpec,
]);
export type ElementSpec = z.infer<typeof elementSpec>;
export type TextSpec = z.infer<typeof textSpec>;
export type BoxSpec = z.infer<typeof boxSpec>;
export type LineSpec = z.infer<typeof lineSpec>;
export type GraphicSpec = z.infer<typeof graphicSpec>;
export type ImageSpec = z.infer<typeof imageSpec>;

export const backgroundSpec = z
  .object({
    color: color.optional().describe("A solid colour"),
    gradient: z
      .object({
        angle: z
          .number()
          .min(0)
          .max(360)
          .optional()
          .describe("Degrees; 0 runs left to right, 90 top to bottom"),
        colors: z.array(color).min(2).max(8),
      })
      .optional()
      .describe("A linear gradient, colours spread evenly"),
  })
  .refine((spec) => Boolean(spec.color) !== Boolean(spec.gradient), {
    message: "Give either color or gradient",
  });
export type BackgroundSpec = z.infer<typeof backgroundSpec>;

export const toBackground = (spec: BackgroundSpec): Background => {
  if (spec.gradient) {
    const { angle = 90, colors } = spec.gradient;
    const last = colors.length - 1;
    return {
      angle,
      stops: colors.map((stop, index) => ({
        color: stop,
        offset: index / last,
      })),
      type: "linear",
    };
  }
  return { color: spec.color ?? "#ffffff", type: "solid" };
};

// Top-left corner for a box of `size` at a keyword spot on the page
export const placeBox = (where: Placement, size: Size, page: Size) => {
  const margin = Math.round(
    Math.min(page.width, page.height) * PLACEMENT_MARGIN
  );
  const left = margin;
  const right = page.width - size.width - margin;
  const top = margin;
  const bottom = page.height - size.height - margin;
  const middleX = (page.width - size.width) / 2;
  const middleY = (page.height - size.height) / 2;
  const spots: Record<Placement, { x: number; y: number }> = {
    bottom: { x: middleX, y: bottom },
    "bottom-left": { x: left, y: bottom },
    "bottom-right": { x: right, y: bottom },
    center: { x: middleX, y: middleY },
    left: { x: left, y: middleY },
    right: { x: right, y: middleY },
    top: { x: middleX, y: top },
    "top-left": { x: left, y: top },
    "top-right": { x: right, y: top },
  };
  return spots[where];
};

// Where a box goes: explicit x/y win, then a keyword, then the factory's
// own spot (the page's centre); a lone x or y keeps the other
const position = (
  spec: { x?: number; y?: number; place?: Placement },
  size: Size,
  page: Size,
  fallback: { x: number; y: number }
) => {
  const base = spec.place ? placeBox(spec.place, size, page) : fallback;
  return { x: spec.x ?? base.x, y: spec.y ?? base.y };
};

// Rough rendered height of a text box: lines at its wrap width
export const estimateTextHeight = (
  text: Pick<
    TextElement,
    "text" | "fontSize" | "lineHeight" | "letterSpacingEm" | "width"
  >
): number => {
  const glyph = text.fontSize * (AVERAGE_GLYPH_EM + text.letterSpacingEm);
  const perLine = Math.max(1, Math.floor(text.width / Math.max(glyph, 1)));
  const lines = text.text
    .split("\n")
    .reduce(
      (count, paragraph) =>
        count + Math.max(1, Math.ceil(paragraph.length / perLine)),
      0
    );
  return lines * text.fontSize * text.lineHeight;
};

// Fields an agent may never set: they'd turn the element into another one,
// or (with an id already in use) make a new element overwrite that one
const FIXED_FIELDS = new Set(["id", "type"]);

// Validates a built element as the save route would, keeping fields this
// version of the schema doesn't know (like the route does). Fields the
// agent supplied itself must be known ones, so a typo is an error rather
// than a change that silently does nothing.
export const finishElement = (
  raw: Record<string, unknown>,
  supplied: Record<string, unknown> = {}
): DesignElement => {
  const blocked = Object.keys(supplied).filter((key) => FIXED_FIELDS.has(key));
  if (blocked.length > 0) {
    throw new Error(`Can't set ${blocked.join(", ")}`);
  }
  const parsed = elementSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(z.prettifyError(parsed.error));
  }
  const unknown = Object.keys(supplied).filter(
    (key) => !Object.hasOwn(parsed.data, key)
  );
  if (unknown.length > 0) {
    throw new Error(
      `Unknown field(s) for a ${parsed.data.type}: ${unknown.join(", ")}`
    );
  }
  return keepUnknownFields(raw, parsed.data);
};

const common = (spec: {
  name?: string;
  opacity?: number;
  rotation?: number;
}) => ({
  ...(spec.name === undefined ? {} : { name: spec.name }),
  ...(spec.opacity === undefined ? {} : { opacity: spec.opacity }),
  ...(spec.rotation === undefined ? {} : { rotation: spec.rotation }),
});

// The look a text spec asks for, on top of the heading preset's
const textStyle = (spec: TextSpec) => ({
  highlight: spec.highlight
    ? {
        color: spec.highlight.color,
        paddingEm: spec.highlight.padding ?? 0.25,
        radiusEm: 0.15,
      }
    : null,
  shadow: spec.shadow
    ? {
        blurEm: spec.shadow.blur ?? 0.08,
        color: spec.shadow.color ?? "#000000b3",
        offsetXEm: spec.shadow.offsetX ?? 0,
        offsetYEm: spec.shadow.offsetY ?? 0.06,
      }
    : null,
  stroke: spec.outline
    ? { color: spec.outline.color, widthEm: spec.outline.width ?? 0.05 }
    : null,
});

export const buildText = (spec: TextSpec, page: Size): DesignElement => {
  if (spec.font && !findFont(spec.font)) {
    throw new Error(`Unknown font "${spec.font}"; see list_fonts`);
  }
  const base = createTextElement("heading", page);
  const width = spec.width ?? Math.round(page.width * TEXT_WIDTH_RATIO);
  const text: TextElement = {
    ...base,
    ...common(spec),
    ...textStyle(spec),
    align: spec.align ?? base.align,
    fill: spec.color ?? base.fill,
    fontId: spec.font ?? base.fontId,
    fontSize: spec.fontSize ?? base.fontSize,
    italic: spec.italic ?? false,
    letterSpacingEm: spec.letterSpacing ?? 0,
    lineHeight: spec.lineHeight ?? base.lineHeight,
    name: spec.name ?? spec.text.slice(0, 40),
    text: spec.text,
    uppercase: spec.uppercase ?? false,
    weight: spec.weight ?? base.weight,
    width,
  };
  const size = { height: estimateTextHeight(text), width };
  const centred = {
    x: (page.width - width) / 2,
    y: (page.height - size.height) / 2,
  };
  return finishElement(
    {
      ...text,
      ...position(spec, size, page, centred),
      ...spec.advanced,
    },
    spec.advanced
  );
};

export const buildBox = (spec: BoxSpec, page: Size): DesignElement => {
  const base = createBoxElement(spec.type, page);
  const size = {
    height: spec.height ?? base.height,
    width: spec.width ?? base.width,
  };
  return finishElement(
    {
      ...base,
      ...common(spec),
      cornerRadius: spec.cornerRadius ?? 0,
      fill: spec.fill ?? base.fill,
      stroke: spec.stroke ?? base.stroke,
      strokeWidth: spec.strokeWidth ?? (spec.stroke ? 4 : 0),
      ...size,
      ...position(spec, size, page, {
        x: (page.width - size.width) / 2,
        y: (page.height - size.height) / 2,
      }),
      ...spec.advanced,
    },
    spec.advanced
  );
};

// Lines keep their geometry in points relative to x/y
export const buildLine = (spec: LineSpec, page: Size): DesignElement => {
  const base = createLinearElement(spec.type, page);
  return finishElement(
    {
      ...base,
      ...common(spec),
      points: [0, 0, spec.x2 - spec.x1, spec.y2 - spec.y1],
      stroke: spec.color ?? base.stroke,
      strokeWidth: spec.strokeWidth ?? base.strokeWidth,
      x: spec.x1,
      y: spec.y1,
      ...spec.advanced,
    },
    spec.advanced
  );
};

export const buildGraphic = (
  spec: GraphicSpec,
  entry: GraphicEntry,
  page: Size
): DesignElement => {
  const base = createGraphicElement(entry, page);
  const longer = Math.max(base.width, base.height);
  const scale = spec.size ? spec.size / longer : 1;
  const size = { height: base.height * scale, width: base.width * scale };
  const palette = spec.colors
    ? base.palette.map((paint, index) => spec.colors?.[index] ?? paint)
    : base.palette;
  return finishElement(
    {
      ...base,
      ...common(spec),
      palette,
      ...size,
      ...position(spec, size, page, {
        x: (page.width - size.width) / 2,
        y: (page.height - size.height) / 2,
      }),
      ...spec.advanced,
    },
    spec.advanced
  );
};

export const buildImage = (
  spec: ImageSpec,
  asset: { id: string; width: number; height: number },
  page: Size
): DesignElement => {
  const base = createImageElement(
    { ...asset, name: spec.name ?? "Image" },
    page
  );
  const aspect = asset.width / asset.height;
  let size = { height: base.height, width: base.width };
  if (spec.width && spec.height) {
    size = { height: spec.height, width: spec.width };
  } else if (spec.width) {
    size = { height: spec.width / aspect, width: spec.width };
  } else if (spec.height) {
    size = { height: spec.height, width: spec.height * aspect };
  }
  return finishElement(
    {
      ...base,
      ...common(spec),
      cornerRadius: spec.cornerRadius ?? 0,
      ...size,
      ...position(spec, size, page, {
        x: (page.width - size.width) / 2,
        y: (page.height - size.height) / 2,
      }),
      ...spec.advanced,
    },
    spec.advanced
  );
};

// An element with some of its fields replaced, checked like a new one
export const patchElement = (
  element: DesignElement,
  changes: Record<string, unknown>
): DesignElement => finishElement({ ...element, ...changes }, changes);

// Graphics carry their vector art, which is long and of no use to an agent
// reading the design: show the rest
export const summarizeElement = (
  element: DesignElement
): Record<string, unknown> => {
  if (element.type === "graphic") {
    const { layers, ...rest } = element;
    return { ...rest, layers: `${layers.length} vector layers` };
  }
  if (element.type === "text") {
    return {
      ...element,
      estimatedHeight: Math.round(estimateTextHeight(element)),
    };
  }
  return element;
};
