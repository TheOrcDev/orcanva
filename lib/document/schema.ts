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
  id: z.string().min(1).max(64),
  locked: z.boolean(),
  name: z.string().max(120),
  opacity: z.number().min(0).max(1),
  rotation: z.number(),
  visible: z.boolean(),
  x: z.number(),
  y: z.number(),
};

export const imageElementSchema = z.object({
  ...baseElement,
  assetId: z.uuid(),
  cornerRadius: z.number().min(0),
  flipX: z.boolean(),
  flipY: z.boolean(),
  height: length,
  type: z.literal("image"),
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

export const textAlignSchema = z.enum(["left", "center", "right"]);

export const textElementSchema = z.object({
  ...baseElement,
  align: textAlignSchema,
  fill: color,
  fontId: z.string().min(1).max(64),
  fontSize: z.number().min(1).max(4000),
  highlight: textHighlightSchema.nullable(),
  italic: z.boolean(),
  letterSpacingEm: z.number().min(-0.5).max(2),
  lineHeight: z.number().min(0.5).max(4),
  shadow: textShadowSchema.nullable(),
  stroke: textStrokeSchema.nullable(),
  text: z.string().max(5000),
  type: z.literal("text"),
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
export type TextElement = z.infer<typeof textElementSchema>;
export type TextAlign = z.infer<typeof textAlignSchema>;
export type TextStroke = z.infer<typeof textStrokeSchema>;
export type TextShadow = z.infer<typeof textShadowSchema>;
export type TextHighlight = z.infer<typeof textHighlightSchema>;
export type RectElement = z.infer<typeof rectElementSchema>;
export type EllipseElement = z.infer<typeof ellipseElementSchema>;
export type LineElement = z.infer<typeof lineElementSchema>;
export type ArrowElement = z.infer<typeof arrowElementSchema>;
export type BoxShapeElement = RectElement | EllipseElement;
export type LinearElement = LineElement | ArrowElement;
export type DesignElement = z.infer<typeof elementSchema>;
export type ElementType = DesignElement["type"];
export type DesignDocument = z.infer<typeof designDocumentSchema>;
