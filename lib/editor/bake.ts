import type {
  BoxShapeElement,
  ImageElement,
  LinearElement,
  TextElement,
} from "@/lib/document/schema";

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

export const bakeBoxTransform = <T extends ImageElement | BoxShapeElement>(
  element: T,
  transform: NodeTransform
): T => ({
  ...element,
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
