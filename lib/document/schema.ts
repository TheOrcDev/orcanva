import { z } from "zod";

export const DOCUMENT_VERSION = 1;
export const MIN_CANVAS_SIZE = 16;
export const MAX_CANVAS_SIZE = 4096;
export const MAX_ELEMENTS = 500;

const color = z.string().min(1).max(64);
const canvasSize = z.number().int().min(MIN_CANVAS_SIZE).max(MAX_CANVAS_SIZE);
const length = z.number().positive().max(100_000);
const em = z.number().min(-10).max(10);

export const solidBackgroundSchema = z.object({
  color,
  type: z.literal("solid"),
});

export const gradientStopSchema = z.object({
  color,
  offset: z.number().min(0).max(1),
});

export const linearBackgroundSchema = z.object({
  angle: z.number().min(0).max(360),
  stops: z.array(gradientStopSchema).min(2).max(8),
  type: z.literal("linear"),
});

export const backgroundSchema = z.discriminatedUnion("type", [
  solidBackgroundSchema,
  linearBackgroundSchema,
]);

// Every element is a box anchored at its top-left corner, rotated around it
const baseElement = {
  // Elements sharing a group id select, move and arrange together. Saved
  // before groups existed means ungrouped.
  groupId: z.string().min(1).max(64).nullable().default(null),
  id: z.string().min(1).max(64),
  locked: z.boolean(),
  name: z.string().max(120),
  opacity: z.number().min(0).max(1),
  rotation: z.number(),
  visible: z.boolean(),
  x: z.number(),
  y: z.number(),
};

// Slider units. Defaults let older rows parse and new sliders arrive later
// without a document migration.
const bipolar = z.number().min(-100).max(100).default(0);
const unipolar = z.number().min(0).max(100).default(0);

export const imageAdjustmentsSchema = z.object({
  blur: unipolar,
  brightness: bipolar,
  contrast: bipolar,
  fade: unipolar,
  grain: unipolar,
  highlights: bipolar,
  saturation: bipolar,
  shadows: bipolar,
  sharpen: unipolar,
  tint: bipolar,
  vignette: unipolar,
  warmth: bipolar,
});

// Rendered on the fly, never baked into the asset. The preset is a plain
// string so a client that doesn't know a newer preset still keeps the image.
export const imageFilterSchema = z.object({
  adjust: imageAdjustmentsSchema,
  preset: z.string().min(1).max(32).nullable(),
  strength: z.number().min(0).max(100),
});

const fraction = z.number().min(0).max(1);

// The part of the photo that shows, as fractions of its width and height.
// Fractions survive swapping in a background-removed cutout and apply to a
// filtered copy of any size.
export const imageCropSchema = z
  .object({
    height: fraction.positive(),
    width: fraction.positive(),
    x: fraction,
    y: fraction,
  })
  .refine(
    (crop) =>
      crop.x + crop.width <= 1 + 1e-6 && crop.y + crop.height <= 1 + 1e-6,
    { message: "Crop must stay inside the photo" }
  );

export const imageElementSchema = z.object({
  ...baseElement,
  assetId: z.uuid(),
  cornerRadius: z.number().min(0),
  // null = the whole photo; images saved before cropping have no field
  crop: imageCropSchema.nullable().default(null),
  // null = untouched; images saved before filters existed have no field
  filter: imageFilterSchema.nullable().default(null),
  flipX: z.boolean(),
  flipY: z.boolean(),
  height: length,
  type: z.literal("image"),
  width: length,
});

// A shape a photo fills, cropped to cover it. Empty frames wait for a photo
// to be dropped on them. Same photo fields as images, so they share the
// drawing, cropping and filters. The shape id is a plain string so a client
// that doesn't know a newer shape still keeps the frame (it draws a square).
export const frameElementSchema = z.object({
  ...baseElement,
  assetId: z.uuid().nullable(),
  crop: imageCropSchema.nullable().default(null),
  filter: imageFilterSchema.nullable().default(null),
  flipX: z.boolean(),
  flipY: z.boolean(),
  height: length,
  shape: z.string().min(1).max(32),
  type: z.literal("frame"),
  width: length,
});

// Effect sizes are stored in em (relative to fontSize) so scaling keeps the look
export const textStrokeSchema = z.object({
  color,
  widthEm: z.number().min(0).max(1),
});

export const textShadowSchema = z.object({
  blurEm: z.number().min(0).max(2),
  color,
  offsetXEm: em,
  offsetYEm: em,
});

export const textHighlightSchema = z.object({
  color,
  paddingEm: z.number().min(0).max(2),
  radiusEm: z.number().min(0).max(2),
});

// A text's fill as a gradient across its box (like a page background)
export const textGradientSchema = z.object({
  angle: z.number().min(0).max(360),
  stops: z.array(gradientStopSchema).min(2).max(8),
});

// One Canva-style effect (hollow, splice, echo, glitch, neon, lift). The
// kind is a plain string so a client that doesn't know a newer one still
// keeps the text (it draws it plainly).
export const textEffectSchema = z.object({
  angle: z.number().min(0).max(360),
  color,
  intensity: z.number().min(0).max(100),
  kind: z.string().min(1).max(32),
  offsetEm: z.number().min(0).max(1),
});

// A style on part of a text: characters [start, end) of `text`. Set keys
// override the text's own; sizes are relative to its font size, so scaling
// the box still only changes `fontSize`.
export const textMarkSchema = z
  .object({
    end: z.number().int().min(1).max(5000),
    fill: color.optional(),
    fontId: z.string().min(1).max(64).optional(),
    italic: z.boolean().optional(),
    sizeEm: z.number().min(0.1).max(10).optional(),
    start: z.number().int().min(0).max(5000),
    strike: z.boolean().optional(),
    underline: z.boolean().optional(),
    weight: z.number().int().min(100).max(900).optional(),
  })
  .refine((mark) => mark.end > mark.start, {
    message: "A mark covers at least one character",
  });

export const textAlignSchema = z.enum(["left", "center", "right"]);

export const textElementSchema = z.object({
  ...baseElement,
  align: textAlignSchema,
  // Bends the text along a circle, -100 (smile) to 100 (rainbow); 0 is
  // straight, as is all text saved before curving
  curve: z.number().min(-100).max(100).default(0),
  // Text saved before effects has none
  effect: textEffectSchema.nullable().default(null),
  fill: color,
  // Replaces the fill when set; text saved before gradients has none
  fillGradient: textGradientSchema.nullable().default(null),
  fontId: z.string().min(1).max(64),
  fontSize: z.number().min(1).max(4000),
  highlight: textHighlightSchema.nullable(),
  italic: z.boolean(),
  letterSpacingEm: z.number().min(-0.5).max(2),
  lineHeight: z.number().min(0.5).max(4),
  // Styles on parts of the text; text saved before has none
  marks: z.array(textMarkSchema).max(500).default([]),
  shadow: textShadowSchema.nullable(),
  strike: z.boolean().default(false),
  stroke: textStrokeSchema.nullable(),
  text: z.string().max(5000),
  type: z.literal("text"),
  underline: z.boolean().default(false),
  uppercase: z.boolean(),
  weight: z.number().int().min(100).max(900),
  width: length,
});

const boxShapeFields = {
  ...baseElement,
  cornerRadius: z.number().min(0),
  fill: color,
  height: length,
  stroke: color,
  strokeWidth: z.number().min(0).max(500),
  width: length,
};

export const rectElementSchema = z.object({
  ...boxShapeFields,
  type: z.literal("rect"),
});

export const ellipseElementSchema = z.object({
  ...boxShapeFields,
  type: z.literal("ellipse"),
});

// Lines never rotate: geometry lives in points relative to x/y
const lineFields = {
  ...baseElement,
  points: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  stroke: color,
  strokeWidth: z.number().positive().max(500),
};

export const lineElementSchema = z.object({
  ...lineFields,
  type: z.literal("line"),
});

export const arrowElementSchema = z.object({
  ...lineFields,
  type: z.literal("arrow"),
});

export const elementSchema = z.discriminatedUnion("type", [
  imageElementSchema,
  frameElementSchema,
  textElementSchema,
  rectElementSchema,
  ellipseElementSchema,
  lineElementSchema,
  arrowElementSchema,
]);

export const designDocumentSchema = z.object({
  background: backgroundSchema,
  // Array order is z-order: first element is at the bottom
  elements: z.array(elementSchema).max(MAX_ELEMENTS),
  height: canvasSize,
  version: z.literal(DOCUMENT_VERSION),
  width: canvasSize,
});

export type Background = z.infer<typeof backgroundSchema>;
export type GradientStop = z.infer<typeof gradientStopSchema>;
export type ImageElement = z.infer<typeof imageElementSchema>;
export type ImageAdjustments = z.infer<typeof imageAdjustmentsSchema>;
export type ImageFilter = z.infer<typeof imageFilterSchema>;
export type ImageCrop = z.infer<typeof imageCropSchema>;
export type FrameElement = z.infer<typeof frameElementSchema>;
// Elements that show a photo
export type PhotoElement = ImageElement | FrameElement;
export type TextElement = z.infer<typeof textElementSchema>;
export type TextAlign = z.infer<typeof textAlignSchema>;
export type TextStroke = z.infer<typeof textStrokeSchema>;
export type TextShadow = z.infer<typeof textShadowSchema>;
export type TextHighlight = z.infer<typeof textHighlightSchema>;
export type TextGradient = z.infer<typeof textGradientSchema>;
export type TextEffect = z.infer<typeof textEffectSchema>;
export type TextMark = z.infer<typeof textMarkSchema>;
export type RectElement = z.infer<typeof rectElementSchema>;
export type EllipseElement = z.infer<typeof ellipseElementSchema>;
export type LineElement = z.infer<typeof lineElementSchema>;
export type ArrowElement = z.infer<typeof arrowElementSchema>;
export type BoxShapeElement = RectElement | EllipseElement;
export type LinearElement = LineElement | ArrowElement;
export type DesignElement = z.infer<typeof elementSchema>;
export type ElementType = DesignElement["type"];
export type DesignDocument = z.infer<typeof designDocumentSchema>;

// The largest element a client may write, as JSON
export const MAX_ELEMENT_JSON_LENGTH = 64_000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// Puts back the top-level fields validation stripped. Editors stay open
// across deploys, so a tab loaded before a release must not erase what newer
// code wrote (a group, a crop, text styles) the moment it edits that element.
export const keepUnknownFields = (
  raw: unknown,
  element: DesignElement
): DesignElement =>
  isRecord(raw) ? ({ ...raw, ...element } as DesignElement) : element;

// Validates an element, keeping fields this version doesn't know
export const parseElement = (raw: unknown): DesignElement | null => {
  const parsed = elementSchema.safeParse(raw);
  return parsed.success ? keepUnknownFields(raw, parsed.data) : null;
};
