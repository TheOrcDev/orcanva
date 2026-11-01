import type Konva from "konva";

import type { Rect } from "@/lib/document/geometry";
import type { DesignDocument } from "@/lib/document/schema";

// Boxes as the selection handles draw them
const BOX_OPTIONS = { skipShadow: true, skipStroke: true } as const;

// A node's box in page coordinates
export const boxOf = (node: Konva.Node, page: Konva.Group): Rect =>
  node.getClientRect({ relativeTo: page, ...BOX_OPTIONS });

// What moving or resizing elements can snap to: the page and every other
// visible element, measured once when the gesture starts
export const collectSnapTargets = (
  page: Konva.Group,
  document: DesignDocument,
  moving: ReadonlySet<string>
): Rect[] => {
  const targets: Rect[] = [
    { height: document.height, width: document.width, x: 0, y: 0 },
  ];
  for (const element of document.elements) {
    const node =
      element.visible && !moving.has(element.id)
        ? page.findOne(`#${element.id}`)
        : undefined;
    if (node) {
      targets.push(boxOf(node, page));
    }
  }
  return targets;
};

// Holding ⌘ or Ctrl during a gesture turns snapping off
export const isFreeMove = (event: unknown): boolean =>
  event instanceof MouseEvent && (event.metaKey || event.ctrlKey);
