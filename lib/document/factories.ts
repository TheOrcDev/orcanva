import { centerIn, fitWithin } from "@/lib/document/geometry";
import type { Point, Size } from "@/lib/document/geometry";
import { DOCUMENT_VERSION } from "@/lib/document/schema";
import type {
  DesignDocument,
  DesignElement,
  EllipseElement,
  ImageElement,
  LinearElement,
  RectElement,
  TextElement,
} from "@/lib/document/schema";
import { DEFAULT_FONT_ID } from "@/lib/fonts/catalog";

export const createId = (): string => crypto.randomUUID();

export const DEFAULT_BACKGROUND_COLOR = "#ffffff";

export const createDocument = (size: Size): DesignDocument => ({
  background: { color: DEFAULT_BACKGROUND_COLOR, type: "solid" },
  elements: [],
  height: size.height,
  version: DOCUMENT_VERSION,
  width: size.width,
});

const baseFields = (name: string) => ({
  id: createId(),
  locked: false,
  name,
  opacity: 1,
  rotation: 0,
  visible: true,
});

// Images land at most 80% of the page, centered on a point (drop/paste)
const IMAGE_MAX_PAGE_RATIO = 0.8;

export const createImageElement = (
  asset: { id: string; width: number; height: number; name?: string },
  page: Size,
  at?: Point
): ImageElement => {
  const bounds = {
    height: page.height * IMAGE_MAX_PAGE_RATIO,
    width: page.width * IMAGE_MAX_PAGE_RATIO,
  };
  const size =
    asset.width > bounds.width || asset.height > bounds.height
      ? fitWithin(asset, bounds)
      : { height: asset.height, width: asset.width };
  const origin = at
    ? { x: at.x - size.width / 2, y: at.y - size.height / 2 }
    : centerIn(size, page);

  return {
    ...baseFields(asset.name ?? "Image"),
    assetId: asset.id,
    cornerRadius: 0,
    flipX: false,
    flipY: false,
    height: size.height,
    type: "image",
    width: size.width,
    x: origin.x,
    y: origin.y,
  };
};

export type TextPreset = "heading" | "subheading" | "body";

const TEXT_PRESETS: Record<
  TextPreset,
  {
    name: string;
    text: string;
    // Relative to page height so presets read well at any resolution
    sizeRatio: number;
    fontId: string;
    weight: number;
    uppercase: boolean;
    lineHeight: number;
  }
> = {
  body: {
    fontId: "inter",
    lineHeight: 1.3,
    name: "Body",
    sizeRatio: 0.045,
    text: "Add a little bit of body text",
    uppercase: false,
    weight: 400,
  },
  heading: {
    fontId: DEFAULT_FONT_ID,
    lineHeight: 1.05,
    name: "Heading",
    sizeRatio: 0.14,
    text: "Add a heading",
    uppercase: true,
    weight: 400,
  },
  subheading: {
    fontId: "montserrat",
    lineHeight: 1.15,
    name: "Subheading",
    sizeRatio: 0.07,
    text: "Add a subheading",
    uppercase: false,
    weight: 700,
  },
};

export const createTextElement = (
  preset: TextPreset,
  page: Size
): TextElement => {
  const config = TEXT_PRESETS[preset];
  const fontSize = Math.max(8, Math.round(page.height * config.sizeRatio));
  const width = Math.round(page.width * 0.8);
  // Rough first-render height; Konva measures the real one
  const height = fontSize * config.lineHeight;
  const origin = centerIn({ height, width }, page);

  return {
    ...baseFields(config.name),
    align: "center",
    fill: "#111111",
    fontId: config.fontId,
    fontSize,
    highlight: null,
    italic: false,
    letterSpacingEm: 0,
    lineHeight: config.lineHeight,
    shadow: null,
    stroke: null,
    text: config.text,
    type: "text",
    uppercase: config.uppercase,
    weight: config.weight,
    width,
    x: origin.x,
    y: origin.y,
  };
};

export const createBoxElement = (
  type: "rect" | "ellipse",
  page: Size
): RectElement | EllipseElement => {
  const side = Math.round(Math.min(page.width, page.height) * 0.35);
  const size = { height: side, width: side };
  const origin = centerIn(size, page);
  const fields = {
    ...baseFields(type === "rect" ? "Rectangle" : "Ellipse"),
    cornerRadius: 0,
    fill: "#ff3b30",
    height: size.height,
    stroke: "#111111",
    strokeWidth: 0,
    width: size.width,
    x: origin.x,
    y: origin.y,
  };
  return type === "rect"
    ? { ...fields, type: "rect" }
    : { ...fields, type: "ellipse" };
};

export const createLinearElement = (
  type: "line" | "arrow",
  page: Size
): LinearElement => {
  const length = Math.round(page.width * 0.4);
  const fields = {
    ...baseFields(type === "line" ? "Line" : "Arrow"),
    points: [0, 0, length, 0] as [number, number, number, number],
    stroke: "#111111",
    strokeWidth: Math.max(2, Math.round(page.height * 0.012)),
    x: (page.width - length) / 2,
    y: page.height / 2,
  };
  return type === "line"
    ? { ...fields, type: "line" }
    : { ...fields, type: "arrow" };
};

const DUPLICATE_OFFSET = 24;

export const duplicateElement = <T extends DesignElement>(element: T): T => ({
  ...element,
  id: createId(),
  locked: false,
  name: `${element.name} copy`,
  x: element.x + DUPLICATE_OFFSET,
  y: element.y + DUPLICATE_OFFSET,
});
