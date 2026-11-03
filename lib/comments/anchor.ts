import type { CommentAnchor, DesignComment } from "@/lib/comments/schema";
import type { Point } from "@/lib/document/geometry";
import type { DesignElement, LinearElement } from "@/lib/document/schema";

// A pin on an element follows it. The pin is kept in the element's own
// frame: boxes and text from their top-left corner, unrotated (they turn
// about that corner), and scaled with the element's width (and a box's
// height). Lines and arrows never rotate: their geometry is in their points,
// so a pin on one is kept along it, from its first point toward its second,
// scaled with its length.

const DEGREES = Math.PI / 180;

const rotate = ({ x, y }: Point, degrees: number): Point => {
  const cos = Math.cos(degrees * DEGREES);
  const sin = Math.sin(degrees * DEGREES);
  return { x: x * cos - y * sin, y: x * sin + y * cos };
};

const isLinear = (element: DesignElement): element is LinearElement =>
  element.type === "line" || element.type === "arrow";

// A line's first point (in its own frame), its direction and length
const lineFrame = (element: LinearElement) => {
  const [x1, y1, x2, y2] = element.points;
  const length = Math.hypot(x2 - x1, y2 - y1);
  return {
    length,
    start: { x: x1, y: y1 },
    unit:
      length > 0
        ? { x: (x2 - x1) / length, y: (y2 - y1) / length }
        : { x: 1, y: 0 },
  };
};

// What a pin on the element scales with. Text has no stored height (it
// comes from its lines), so pins on it scale with its width alone.
const anchorSize = (
  element: DesignElement
): { width: number; height: number | null } => {
  switch (element.type) {
    case "line":
    case "arrow": {
      return { height: null, width: lineFrame(element).length };
    }
    case "text": {
      return { height: null, width: element.width };
    }
    case "image":
    case "frame":
    case "rect":
    case "ellipse":
    case "graphic": {
      return { height: element.height, width: element.width };
    }
    default: {
      return element satisfies never;
    }
  }
};

// A pin at `point` (page coordinates) on the element. Null when the element
// has no size to keep it by (a line of zero length).
export const anchorFor = (
  element: DesignElement,
  point: Point
): CommentAnchor | null => {
  const { height, width } = anchorSize(element);
  if (!(width > 0)) {
    return null;
  }
  const relative = { x: point.x - element.x, y: point.y - element.y };
  if (isLinear(element)) {
    const { start, unit } = lineFrame(element);
    const fromStart = { x: relative.x - start.x, y: relative.y - start.y };
    return {
      anchorHeight: null,
      anchorWidth: width,
      // How far along the line, and how far to its side
      anchorX: fromStart.x * unit.x + fromStart.y * unit.y,
      anchorY: unit.x * fromStart.y - unit.y * fromStart.x,
      elementId: element.id,
    };
  }
  const local = rotate(relative, -element.rotation);
  return {
    anchorHeight: height !== null && height > 0 ? height : null,
    anchorWidth: width,
    anchorX: local.x,
    anchorY: local.y,
    elementId: element.id,
  };
};

export type PinSource = Pick<
  DesignComment,
  | "anchorHeight"
  | "anchorWidth"
  | "anchorX"
  | "anchorY"
  | "elementId"
  | "x"
  | "y"
>;

// The anchor a pin keeps on its element, when it has one
export const pinAnchor = (pin: PinSource): CommentAnchor | null =>
  pin.elementId !== null &&
  pin.anchorX !== null &&
  pin.anchorY !== null &&
  pin.anchorWidth !== null &&
  pin.anchorWidth > 0
    ? {
        anchorHeight: pin.anchorHeight,
        anchorWidth: pin.anchorWidth,
        anchorX: pin.anchorX,
        anchorY: pin.anchorY,
        elementId: pin.elementId,
      }
    : null;

// The pin in the element's own coordinates at the element's size now: what
// its Konva group maps onto the page, mid-drag included
export const anchorLocal = (
  anchor: CommentAnchor,
  element: DesignElement
): Point => {
  const { height, width } = anchorSize(element);
  const scaleX = width / anchor.anchorWidth;
  const scaleY =
    height !== null && anchor.anchorHeight !== null
      ? height / anchor.anchorHeight
      : scaleX;
  if (isLinear(element)) {
    const { start, unit } = lineFrame(element);
    const along = anchor.anchorX * scaleX;
    const across = anchor.anchorY;
    return {
      x: start.x + unit.x * along - unit.y * across,
      y: start.y + unit.y * along + unit.x * across,
    };
  }
  return { x: anchor.anchorX * scaleX, y: anchor.anchorY * scaleY };
};

// "page": pinned to the page. "element": following its element.
// "detached": its element is gone (deleted, or not restored), so it stays
// where it was put; it follows again if the element comes back.
export type PinState = "page" | "element" | "detached";

export interface PlacedPin extends Point {
  state: PinState;
}

// Where a thread's pin is on the page now. `element` is the one with the
// pin's element id, if the page has it.
export const pinPoint = (
  pin: PinSource,
  element: DesignElement | undefined
): PlacedPin => {
  const anchor = pinAnchor(pin);
  const fallback = { x: pin.x ?? 0, y: pin.y ?? 0 };
  if (!anchor) {
    return { ...fallback, state: "page" };
  }
  if (element?.id !== anchor.elementId) {
    return { ...fallback, state: "detached" };
  }
  const local = rotate(anchorLocal(anchor, element), element.rotation);
  return { state: "element", x: element.x + local.x, y: element.y + local.y };
};

// A spot on the element for a comment placed without a click (the Comments
// tab's New comment): a box's centre, the middle of text's first line
// height (text has no stored height), a line's midpoint. Page coordinates.
export const elementSpot = (element: DesignElement): Point => {
  if (isLinear(element)) {
    const [x1, y1, x2, y2] = element.points;
    return { x: element.x + (x1 + x2) / 2, y: element.y + (y1 + y2) / 2 };
  }
  const { height, width } = anchorSize(element);
  const local = rotate(
    { x: width / 2, y: height === null ? 0 : height / 2 },
    element.rotation
  );
  return { x: element.x + local.x, y: element.y + local.y };
};
