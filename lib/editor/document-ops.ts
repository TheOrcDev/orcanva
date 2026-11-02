import { refitFrameCrop } from "@/lib/document/crop";
import { duplicateElement } from "@/lib/document/factories";
import type { Rect, Size } from "@/lib/document/geometry";
import type {
  Background,
  DesignDocument,
  DesignElement,
} from "@/lib/document/schema";
import { regroupCopies } from "@/lib/editor/groups";
import { isFullPage, wholeBox } from "@/lib/editor/page-crop";

type DistributivePartial<T> = T extends unknown
  ? Partial<Omit<T, "id" | "type">>
  : never;

export type ElementPatch = DistributivePartial<DesignElement>;

export const findElement = (
  document: DesignDocument,
  id: string
): DesignElement | undefined =>
  document.elements.find((element) => element.id === id);

// True when every patched value already matches, e.g. a field committing the
// same value twice (Enter, then blur). Such edits must not become undo steps.
const isNoOpPatch = (element: DesignElement, patch: ElementPatch): boolean =>
  Object.entries(patch).every(([key, value]) =>
    Object.is(element[key as keyof DesignElement], value)
  );

export const updateElement = (
  document: DesignDocument,
  id: string,
  patch: ElementPatch
): DesignDocument => {
  let changed = false;
  const elements = document.elements.map((element) => {
    if (element.id !== id || isNoOpPatch(element, patch)) {
      return element;
    }
    changed = true;
    // Patches come from type-specific panels, so the merged shape is valid
    return { ...element, ...patch } as DesignElement;
  });
  return changed ? { ...document, elements } : document;
};

export const replaceElement = (
  document: DesignDocument,
  next: DesignElement
): DesignDocument => ({
  ...document,
  elements: document.elements.map((element) =>
    element.id === next.id ? next : element
  ),
});

export const insertElement = (
  document: DesignDocument,
  element: DesignElement,
  index = document.elements.length
): DesignDocument => {
  const elements = [...document.elements];
  elements.splice(index, 0, element);
  return { ...document, elements };
};

export const appendElements = (
  document: DesignDocument,
  elements: readonly DesignElement[]
): DesignDocument =>
  elements.length === 0
    ? document
    : { ...document, elements: [...document.elements, ...elements] };

export const removeElements = (
  document: DesignDocument,
  ids: readonly string[]
): DesignDocument => {
  const remove = new Set(ids);
  const elements = document.elements.filter(
    (element) => !remove.has(element.id)
  );
  return elements.length === document.elements.length
    ? document
    : { ...document, elements };
};

// Inserts the copies as one block above the topmost original (directly
// above it for one element); copied groups become new groups. Returns the
// new ids.
export const duplicateElements = (
  document: DesignDocument,
  ids: readonly string[]
): { document: DesignDocument; ids: string[] } => {
  const targets = new Set(ids);
  const originals = document.elements.filter((element) =>
    targets.has(element.id)
  );
  const copies = regroupCopies(
    originals.map((element) => duplicateElement(element))
  );
  const topmost = originals.at(-1);
  if (!topmost) {
    return { document, ids: [] };
  }
  const elements: DesignElement[] = [];
  for (const element of document.elements) {
    elements.push(element);
    if (element === topmost) {
      elements.push(...copies);
    }
  }
  return {
    document: { ...document, elements },
    ids: copies.map((copy) => copy.id),
  };
};

// Puts the elements in the given order (bottom of the stack first); ids
// it doesn't mention keep their place at the end
export const reorderElements = (
  document: DesignDocument,
  ids: readonly string[]
): DesignDocument => {
  const byId = new Map(
    document.elements.map((element) => [element.id, element])
  );
  const ordered = ids.flatMap((id) => {
    const element = byId.get(id);
    return element ? [element] : [];
  });
  const listed = new Set(ids);
  const elements = [
    ...ordered,
    ...document.elements.filter((element) => !listed.has(element.id)),
  ];
  const unchanged = elements.every(
    (element, index) => element === document.elements[index]
  );
  return unchanged ? document : { ...document, elements };
};

export type ArrangeDirection = "forward" | "backward" | "front" | "back";

export const moveElementTo = (
  document: DesignDocument,
  id: string,
  toIndex: number
): DesignDocument => {
  const fromIndex = document.elements.findIndex((element) => element.id === id);
  const target = Math.max(
    0,
    Math.min(document.elements.length - 1, Math.round(toIndex))
  );
  if (fromIndex === -1 || fromIndex === target) {
    return document;
  }
  const elements = [...document.elements];
  const [moved] = elements.splice(fromIndex, 1);
  if (!moved) {
    return document;
  }
  elements.splice(target, 0, moved);
  return { ...document, elements };
};

export const arrangeElement = (
  document: DesignDocument,
  id: string,
  direction: ArrangeDirection
): DesignDocument => {
  const index = document.elements.findIndex((element) => element.id === id);
  if (index === -1) {
    return document;
  }
  const targets: Record<ArrangeDirection, number> = {
    back: 0,
    backward: index - 1,
    forward: index + 1,
    front: document.elements.length - 1,
  };
  return moveElementTo(document, id, targets[direction]);
};

// Puts a moving element past its neighbour when the neighbour stays
const swapIfMoving = (
  elements: DesignElement[],
  from: number,
  to: number,
  isMoving: (element: DesignElement | undefined) => boolean
) => {
  const moving = elements[from];
  const neighbour = elements[to];
  if (moving && neighbour && isMoving(moving) && !isMoving(neighbour)) {
    elements[from] = neighbour;
    elements[to] = moving;
  }
};

// Moves several elements a step up or down the stack, or to an end of it,
// keeping their order among themselves. Elements next to each other move as
// one block.
export const arrangeElements = (
  document: DesignDocument,
  ids: readonly string[],
  direction: ArrangeDirection
): DesignDocument => {
  const selected = new Set(ids);
  const isSelected = (element: DesignElement | undefined) =>
    element !== undefined && selected.has(element.id);
  let elements = [...document.elements];
  if (direction === "front" || direction === "back") {
    const moving = elements.filter((element) => isSelected(element));
    const rest = elements.filter((element) => !isSelected(element));
    elements =
      direction === "front" ? [...rest, ...moving] : [...moving, ...rest];
  } else if (direction === "forward") {
    for (let index = elements.length - 2; index >= 0; index -= 1) {
      swapIfMoving(elements, index, index + 1, isSelected);
    }
  } else {
    for (let index = 1; index < elements.length; index += 1) {
      swapIfMoving(elements, index, index - 1, isSelected);
    }
  }
  const unchanged = elements.every(
    (element, index) => element === document.elements[index]
  );
  return unchanged ? document : { ...document, elements };
};

export const setBackground = (
  document: DesignDocument,
  background: Background
): DesignDocument => ({ ...document, background });

const scaleElement = (
  element: DesignElement,
  sx: number,
  sy: number
): DesignElement => {
  const position = { x: element.x * sx, y: element.y * sy };
  const uniform = Math.min(sx, sy);
  switch (element.type) {
    case "image":
    case "rect":
    case "ellipse": {
      return {
        ...element,
        ...position,
        height: element.height * sy,
        width: element.width * sx,
      };
    }
    case "frame": {
      const size = { height: element.height * sy, width: element.width * sx };
      return {
        ...element,
        ...position,
        ...size,
        crop: element.assetId ? refitFrameCrop(element, size) : element.crop,
      };
    }
    case "text": {
      return {
        ...element,
        ...position,
        fontSize: element.fontSize * uniform,
        width: element.width * sx,
      };
    }
    case "line":
    case "arrow": {
      const [x1, y1, x2, y2] = element.points;
      return {
        ...element,
        ...position,
        points: [x1 * sx, y1 * sy, x2 * sx, y2 * sy],
        strokeWidth: element.strokeWidth * uniform,
      };
    }
    default: {
      return element;
    }
  }
};

// Changes the canvas size; optionally scales content to keep the layout
export const resizeDocument = (
  document: DesignDocument,
  size: Size,
  scaleContent: boolean
): DesignDocument => {
  if (size.width === document.width && size.height === document.height) {
    return document;
  }
  const sx = size.width / document.width;
  const sy = size.height / document.height;
  return {
    ...document,
    elements: scaleContent
      ? document.elements.map((element) => scaleElement(element, sx, sy))
      : document.elements,
    height: size.height,
    width: size.width,
  };
};

// Keeps part of the page as the whole page: everything moves with it, so
// nothing shifts on screen. Elements left outside stay, off the page.
export const cropDocument = (
  document: DesignDocument,
  box: Rect
): DesignDocument => {
  const area = wholeBox(box, document);
  if (isFullPage(area, document)) {
    return document;
  }
  const moved = area.x !== 0 || area.y !== 0;
  return {
    ...document,
    elements: moved
      ? document.elements.map((element) => ({
          ...element,
          x: element.x - area.x,
          y: element.y - area.y,
        }))
      : document.elements,
    height: area.height,
    width: area.width,
  };
};
