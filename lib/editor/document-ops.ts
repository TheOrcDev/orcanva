import { duplicateElement } from "@/lib/document/factories";
import type { Size } from "@/lib/document/geometry";
import type {
  Background,
  DesignDocument,
  DesignElement,
} from "@/lib/document/schema";

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

// Inserts copies directly above their originals; returns the new ids
export const duplicateElements = (
  document: DesignDocument,
  ids: readonly string[]
): { document: DesignDocument; ids: string[] } => {
  const targets = new Set(ids);
  const newIds: string[] = [];
  const elements: DesignElement[] = [];
  for (const element of document.elements) {
    elements.push(element);
    if (targets.has(element.id)) {
      const copy = duplicateElement(element);
      newIds.push(copy.id);
      elements.push(copy);
    }
  }
  return { document: { ...document, elements }, ids: newIds };
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
