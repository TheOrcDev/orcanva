import { DEFAULT_FRAME_SHAPE } from "@/lib/document/frame-shapes";
import { centerIn, fitWithin } from "@/lib/document/geometry";
import type { Point, Size } from "@/lib/document/geometry";
import { DOCUMENT_VERSION } from "@/lib/document/schema";
import type {
  DesignDocument,
  DesignElement,
  EllipseElement,
  FrameElement,
  ImageElement,
  LinearElement,
  RectElement,
  TextElement,
} from "@/lib/document/schema";
import { DEFAULT_FONT_ID } from "@/lib/fonts/catalog";

const HEX_BYTE = Array.from({ length: 256 }, (_, byte) =>
  byte.toString(16).padStart(2, "0")
);

// RFC 4122 v4 from getRandomValues, which (unlike randomUUID) also works
// outside secure contexts, e.g. opening the dev server via a LAN IP
const randomUuid = (): string => {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  // Version nibble = 4 and variant bits = 10, set arithmetically
  bytes[6] = ((bytes[6] ?? 0) % 16) + 64;
  bytes[8] = ((bytes[8] ?? 0) % 64) + 128;
  const hex = [...bytes].map((byte) => HEX_BYTE[byte] ?? "00").join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

export const createId = (): string =>
  typeof crypto.randomUUID === "function" ? crypto.randomUUID() : randomUuid();

export const DEFAULT_BACKGROUND_COLOR = "#ffffff";

export const createDocument = (size: Size): DesignDocument => ({
  background: { color: DEFAULT_BACKGROUND_COLOR, type: "solid" },
  elements: [],
  height: size.height,
  version: DOCUMENT_VERSION,
  width: size.width,
});

const baseFields = (name: string) => ({
  groupId: null,
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
    crop: null,
    filter: null,
    flipX: false,
    flipY: false,
    height: size.height,
    type: "image",
    width: size.width,
    x: origin.x,
    y: origin.y,
  };
};

export type TextPreset =
  | "heading"
  | "subheading"
  | "body"
  | "outlined"
  | "label"
  | "shadow";

interface TextPresetConfig {
  name: string;
  text: string;
  // Relative to page height so presets read well at any resolution
  sizeRatio: number;
  fontId: string;
  weight: number;
  uppercase: boolean;
  lineHeight: number;
  style?: Partial<
    Pick<TextElement, "fill" | "stroke" | "shadow" | "highlight">
  >;
}

export const TEXT_PRESETS: Record<TextPreset, TextPresetConfig> = {
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
  label: {
    fontId: "montserrat",
    lineHeight: 1.1,
    name: "Label",
    sizeRatio: 0.07,
    style: {
      highlight: { color: "#ffd60a", paddingEm: 0.25, radiusEm: 0.15 },
    },
    text: "New video",
    uppercase: true,
    weight: 800,
  },
  outlined: {
    fontId: DEFAULT_FONT_ID,
    lineHeight: 1.05,
    name: "Outlined title",
    sizeRatio: 0.16,
    style: {
      fill: "#ffffff",
      shadow: {
        blurEm: 0.08,
        color: "#000000b3",
        offsetXEm: 0,
        offsetYEm: 0.06,
      },
      stroke: { color: "#111111", widthEm: 0.05 },
    },
    text: "Big title",
    uppercase: true,
    weight: 400,
  },
  shadow: {
    fontId: "bebas-neue",
    lineHeight: 1,
    name: "Shadow caption",
    sizeRatio: 0.12,
    style: {
      fill: "#ffffff",
      shadow: {
        blurEm: 0.15,
        color: "#000000cc",
        offsetXEm: 0.04,
        offsetYEm: 0.04,
      },
    },
    text: "Watch this",
    uppercase: false,
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
    fillGradient: null,
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
    ...config.style,
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

// An empty frame in the middle of the page, waiting for a photo
export const createFrameElement = (
  page: Size,
  shape: string = DEFAULT_FRAME_SHAPE
): FrameElement => {
  const side = Math.round(Math.min(page.width, page.height) * 0.4);
  const origin = centerIn({ height: side, width: side }, page);
  return {
    ...baseFields("Frame"),
    assetId: null,
    crop: null,
    filter: null,
    flipX: false,
    flipY: false,
    height: side,
    shape,
    type: "frame",
    width: side,
    x: origin.x,
    y: origin.y,
  };
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
