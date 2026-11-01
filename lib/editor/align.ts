import type { Rect } from "@/lib/document/geometry";
import type { DesignDocument } from "@/lib/document/schema";
import { findElement, updateElement } from "@/lib/editor/document-ops";

export type AlignEdge =
  | "left"
  | "center"
  | "right"
  | "top"
  | "middle"
  | "bottom";

export type DistributeAxis = "x" | "y";

// What moves as one when aligning (an element, or every element of a group)
// and the box around it on the page, as the canvas measured it. Rotated
// elements and text only have a known box once drawn.
export interface AlignUnit {
  ids: readonly string[];
  box: Rect;
}

const moveUnit = (
  document: DesignDocument,
  unit: AlignUnit,
  dx: number,
  dy: number
): DesignDocument => {
  if (Math.abs(dx) < 1e-9 && Math.abs(dy) < 1e-9) {
    return document;
  }
  let next = document;
  for (const id of unit.ids) {
    const element = findElement(next, id);
    if (element) {
      next = updateElement(next, id, { x: element.x + dx, y: element.y + dy });
    }
  }
  return next;
};

const shiftTo = (edge: AlignEdge, box: Rect, reference: Rect) => {
  switch (edge) {
    case "left": {
      return { dx: reference.x - box.x, dy: 0 };
    }
    case "center": {
      return {
        dx: reference.x + reference.width / 2 - (box.x + box.width / 2),
        dy: 0,
      };
    }
    case "right": {
      return { dx: reference.x + reference.width - (box.x + box.width), dy: 0 };
    }
    case "top": {
      return { dx: 0, dy: reference.y - box.y };
    }
    case "middle": {
      return {
        dx: 0,
        dy: reference.y + reference.height / 2 - (box.y + box.height / 2),
      };
    }
    default: {
      return {
        dx: 0,
        dy: reference.y + reference.height - (box.y + box.height),
      };
    }
  }
};

// Lines every unit up with an edge or centre of the reference box (the
// selection's own box, or the page)
export const alignUnits = (
  document: DesignDocument,
  units: readonly AlignUnit[],
  edge: AlignEdge,
  reference: Rect
): DesignDocument => {
  let next = document;
  for (const unit of units) {
    const { dx, dy } = shiftTo(edge, unit.box, reference);
    next = moveUnit(next, unit, dx, dy);
  }
  return next;
};

const startOf = (box: Rect, axis: DistributeAxis) =>
  axis === "x" ? box.x : box.y;
const sizeOf = (box: Rect, axis: DistributeAxis) =>
  axis === "x" ? box.width : box.height;

// Spaces three or more units evenly between the outermost two, which stay
export const distributeUnits = (
  document: DesignDocument,
  units: readonly AlignUnit[],
  axis: DistributeAxis
): DesignDocument => {
  if (units.length < 3) {
    return document;
  }
  const center = (unit: AlignUnit) =>
    startOf(unit.box, axis) + sizeOf(unit.box, axis) / 2;
  const sorted = units.toSorted((a, b) => center(a) - center(b));
  const [first] = sorted;
  const last = sorted.at(-1);
  if (!(first && last)) {
    return document;
  }
  const span =
    startOf(last.box, axis) + sizeOf(last.box, axis) - startOf(first.box, axis);
  let occupied = 0;
  for (const unit of sorted) {
    occupied += sizeOf(unit.box, axis);
  }
  const gap = (span - occupied) / (sorted.length - 1);
  let next = document;
  let cursor = startOf(first.box, axis) + sizeOf(first.box, axis) + gap;
  for (const unit of sorted.slice(1, -1)) {
    const shift = cursor - startOf(unit.box, axis);
    next = moveUnit(
      next,
      unit,
      axis === "x" ? shift : 0,
      axis === "y" ? shift : 0
    );
    cursor += sizeOf(unit.box, axis) + gap;
  }
  return next;
};
