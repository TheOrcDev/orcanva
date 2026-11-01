import type { Rect } from "@/lib/document/geometry";
import type { DesignDocument, DesignElement } from "@/lib/document/schema";

// Shift-click: adds an element to the selection, or takes it out
export const toggleSelected = (
  selected: readonly string[],
  id: string
): string[] =>
  selected.includes(id)
    ? selected.filter((selectedId) => selectedId !== id)
    : [...selected, id];

// What a gesture may move or change: visible and not locked
export const isEditable = (element: DesignElement): boolean =>
  element.visible && !element.locked;

// ⌘A, and what a selection box can pick up
export const selectableIds = (document: DesignDocument): string[] =>
  document.elements.filter(isEditable).map((element) => element.id);

// The selected elements a drag or transform moves, in z-order
export const editableSelection = (
  document: DesignDocument,
  selected: readonly string[]
): DesignElement[] => {
  const ids = new Set(selected);
  return document.elements.filter(
    (element) => ids.has(element.id) && isEditable(element)
  );
};

export const rectsIntersect = (a: Rect, b: Rect): boolean =>
  a.x <= b.x + b.width &&
  b.x <= a.x + a.width &&
  a.y <= b.y + b.height &&
  b.y <= a.y + a.height;

// The box between two corners, in any order
export const rectFromCorners = (
  a: { x: number; y: number },
  b: { x: number; y: number }
): Rect => ({
  height: Math.abs(b.y - a.y),
  width: Math.abs(b.x - a.x),
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
});

// A selection box picks every element it touches, added to `base` (the
// selection before the drag when Shift was held)
export const boxSelection = (
  base: readonly string[],
  boxes: ReadonlyMap<string, Rect>,
  area: Rect
): string[] => {
  const picked = [...boxes]
    .filter(([id, box]) => !base.includes(id) && rectsIntersect(box, area))
    .map(([id]) => id);
  return [...base, ...picked];
};
