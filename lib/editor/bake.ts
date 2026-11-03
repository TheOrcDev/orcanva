import {
  clampCrop,
  cropOrFull,
  isFullCrop,
  mirrorCrop,
} from "@/lib/document/crop";
import type {
  BoxShapeElement,
  FrameElement,
  GraphicElement,
  ImageCrop,
  ImageElement,
  LinearElement,
  PhotoEffects,
  TextElement,
} from "@/lib/document/schema";
import { scalePhotoEffects } from "@/lib/photo-effects/geometry";

// Konva writes gestures into scale; documents store real sizes with scale 1
export interface NodeTransform {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
}

export const MIN_ELEMENT_SIZE = 4;

const SCALE_EPSILON = 1e-3;

export const normalizeRotation = (degrees: number): number => {
  const wrapped = ((degrees % 360) + 360) % 360;
  const signed = wrapped > 180 ? wrapped - 360 : wrapped;
  return Math.abs(signed) < 1e-6 ? 0 : signed;
};

// Elements that are a box: Konva's scale goes into their width and height
type BoxElement =
  | ImageElement
  | FrameElement
  | BoxShapeElement
  | GraphicElement;

const isPhoto = (element: BoxElement): element is ImageElement | FrameElement =>
  element.type === "image" || element.type === "frame";

// A photo's effects grow with it, by the area's scale so a stretch counts
// evenly. A side-handle crop ends at scale 1 and leaves them alone. A
// graphic's outline is a share of its size, so it grows by itself.
const scaledEffects = (
  element: BoxElement,
  transform: NodeTransform
): Partial<PhotoEffects> =>
  isPhoto(element)
    ? scalePhotoEffects(
        element,
        Math.sqrt(Math.abs(transform.scaleX * transform.scaleY))
      )
    : {};

export const bakeBoxTransform = <T extends BoxElement>(
  element: T,
  transform: NodeTransform
): T => ({
  ...element,
  ...scaledEffects(element, transform),
  height: Math.max(
    MIN_ELEMENT_SIZE,
    element.height * Math.abs(transform.scaleY)
  ),
  rotation: normalizeRotation(transform.rotation),
  width: Math.max(MIN_ELEMENT_SIZE, element.width * Math.abs(transform.scaleX)),
  x: transform.x,
  y: transform.y,
});

// Corner handles scale the type; side handles only change the wrap width.
// The node re-wraps live during side drags, so its width arrives as liveWidth.
export const bakeTextTransform = (
  element: TextElement,
  transform: NodeTransform,
  liveWidth: number
): TextElement => {
  const sx = Math.abs(transform.scaleX);
  const sy = Math.abs(transform.scaleY);
  const isCornerScale = Math.abs(sy - 1) > SCALE_EPSILON;
  const base = {
    ...element,
    rotation: normalizeRotation(transform.rotation),
    x: transform.x,
    y: transform.y,
  };

  if (isCornerScale) {
    return {
      ...base,
      fontSize: Math.max(1, element.fontSize * sy),
      width: Math.max(MIN_ELEMENT_SIZE, liveWidth * sx),
    };
  }
  return { ...base, width: Math.max(MIN_ELEMENT_SIZE, liveWidth * sx) };
};

const MIN_STROKE_WIDTH = 0.5;
const MAX_STROKE_WIDTH = 500;

// Lines never store a rotation, so turning or scaling them with others goes
// into their points. Konva places a point at position + rotate(scale(p)).
// The stroke scales with the line.
export const bakeLineTransform = (
  element: LinearElement,
  transform: NodeTransform
): LinearElement => {
  const radians = (transform.rotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const place = (x: number, y: number): [number, number] => {
    const scaledX = x * transform.scaleX;
    const scaledY = y * transform.scaleY;
    return [scaledX * cos - scaledY * sin, scaledX * sin + scaledY * cos];
  };
  const [x1, y1, x2, y2] = element.points;
  const scale = Math.sqrt(Math.abs(transform.scaleX * transform.scaleY));
  return {
    ...element,
    points: [...place(x1, y1), ...place(x2, y2)],
    rotation: 0,
    strokeWidth: Math.min(
      MAX_STROKE_WIDTH,
      Math.max(MIN_STROKE_WIDTH, element.strokeWidth * scale)
    ),
    x: transform.x,
    y: transform.y,
  };
};

export type ImageEdge = "left" | "right" | "top" | "bottom";

const EDGE_OF_ANCHOR: Record<string, ImageEdge> = {
  "bottom-center": "bottom",
  "middle-left": "left",
  "middle-right": "right",
  "top-center": "top",
};

// The side a Transformer side handle moves, or null for corners
export const edgeOfAnchor = (anchor: string | null): ImageEdge | null =>
  anchor === null ? null : (EDGE_OF_ANCHOR[anchor] ?? null);

const isHorizontal = (edge: ImageEdge) => edge === "left" || edge === "right";

// How wide (left/right) or tall (top/bottom) a photo's frame can get by
// moving one side before it runs out of photo
export const roomToEdge = (element: ImageElement, edge: ImageEdge): number => {
  const visible = mirrorCrop(
    cropOrFull(element.crop),
    element.flipX,
    element.flipY
  );
  const horizontal = isHorizontal(edge);
  const size = horizontal ? element.width : element.height;
  const start = horizontal ? visible.x : visible.y;
  const fraction = horizontal ? visible.width : visible.height;
  const full = size / fraction;
  return edge === "right" || edge === "bottom"
    ? (1 - start) * full
    : (start + fraction) * full;
};

// Moving one side of a photo crops it on that side: the photo stays where
// it is and shows more or less of itself, up to its own edge. `size` is the
// frame's new width (left/right) or height (top/bottom).
export const cropToEdge = (
  element: ImageElement,
  edge: ImageEdge,
  size: number
): { crop: ImageCrop | null; size: number } => {
  const visible = mirrorCrop(
    cropOrFull(element.crop),
    element.flipX,
    element.flipY
  );
  const horizontal = isHorizontal(edge);
  const fraction = horizontal ? visible.width : visible.height;
  const start = horizontal ? visible.x : visible.y;
  const full = (horizontal ? element.width : element.height) / fraction;
  const allowed = Math.min(
    Math.max(MIN_ELEMENT_SIZE, size),
    roomToEdge(element, edge)
  );
  const next = allowed / full;
  const nextStart =
    edge === "left" || edge === "top" ? start + fraction - next : start;
  const cropped = clampCrop(
    horizontal
      ? { ...visible, width: next, x: nextStart }
      : { ...visible, height: next, y: nextStart }
  );
  const crop = mirrorCrop(cropped, element.flipX, element.flipY);
  return { crop: isFullCrop(crop) ? null : crop, size: allowed };
};
