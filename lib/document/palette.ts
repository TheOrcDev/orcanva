import { normalizeHex, parseHex } from "@/lib/document/color";
import type {
  Background,
  BoxShapeElement,
  DesignDocument,
  DesignElement,
  GraphicElement,
  LinearElement,
  PhotoElement,
  TextElement,
} from "@/lib/document/schema";
import { paintedIndexes } from "@/lib/graphics/paint";
import { effectControls } from "@/lib/text/effects";

// The colour picker's "In this design" row
export const MAX_DESIGN_COLORS = 12;

// Colours as stored; null or undefined where a field is off
type Colors = readonly (string | null | undefined)[];

const backgroundColors = (background: Background): Colors =>
  background.type === "solid"
    ? [background.color]
    : background.stops.map((stop) => stop.color);

// Only what shows: a gradient hides the fill, a zero-width outline and an
// effect that takes no colour (Lift) show none
const textColors = (text: TextElement): Colors => [
  ...(text.fillGradient
    ? text.fillGradient.stops.map((stop) => stop.color)
    : [text.fill]),
  ...text.marks.map((mark) => mark.fill),
  text.stroke && text.stroke.widthEm > 0 ? text.stroke.color : null,
  text.shadow?.color,
  text.highlight?.color,
  text.effect && effectControls(text.effect.kind).color
    ? text.effect.color
    : null,
];

const boxColors = (shape: BoxShapeElement): Colors => [
  shape.fill,
  shape.strokeWidth > 0 ? shape.stroke : null,
];

const lineColors = (line: LinearElement): Colors => [line.stroke];

// An empty frame draws no effects; a zero-size outline or glow and a shadow
// right behind the photo don't show
const photoColors = (photo: PhotoElement): Colors => {
  if (photo.type === "frame" && !photo.assetId) {
    return [];
  }
  const { glow, outline, shadow } = photo;
  const shadowShows =
    shadow !== null &&
    (shadow.blur > 0 || shadow.offsetX !== 0 || shadow.offsetY !== 0);
  return [
    outline && outline.width > 0 ? outline.color : null,
    glow && glow.size > 0 ? glow.color : null,
    shadowShows ? shadow.color : null,
  ];
};

// The palette entries some layer paints with, each once however many
// layers use it (an unused entry doesn't show), and the outline when it has
// a width
const graphicColors = (graphic: GraphicElement): Colors => [
  ...paintedIndexes(graphic).map((index) => graphic.palette[index]),
  graphic.outline && graphic.outline.width > 0 ? graphic.outline.color : null,
];

// Where each element type keeps its colours. A new type, or a new colour
// field on one, adds its colours here.
const elementColors = (element: DesignElement): Colors => {
  switch (element.type) {
    case "text": {
      return textColors(element);
    }
    case "rect":
    case "ellipse": {
      return boxColors(element);
    }
    case "line":
    case "arrow": {
      return lineColors(element);
    }
    case "image":
    case "frame": {
      return photoColors(element);
    }
    case "graphic": {
      return graphicColors(element);
    }
    default: {
      // Unreachable while every type is listed; a new one fails to compile
      return element satisfies never;
    }
  }
};

// A colour worth offering: hex, and not fully see-through
const visibleColor = (color: string | null | undefined): string | null => {
  const normal = color ? normalizeHex(color) : null;
  return normal && parseHex(normal)?.[3] !== 0 ? normal : null;
};

// The colours a design uses, page and elements, most-used first (ties in
// the order they're met, bottom to top)
export const documentColors = (
  document: DesignDocument,
  limit: number = MAX_DESIGN_COLORS
): string[] => {
  const counts = new Map<string, number>();
  const colors = [
    ...backgroundColors(document.background),
    ...document.elements.flatMap(elementColors),
  ];
  for (const color of colors) {
    const visible = visibleColor(color);
    if (visible) {
      counts.set(visible, (counts.get(visible) ?? 0) + 1);
    }
  }
  return [...counts]
    .toSorted(([, first], [, second]) => second - first)
    .slice(0, limit)
    .map(([color]) => color);
};
