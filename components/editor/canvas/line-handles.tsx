"use client";

import type Konva from "konva";
import { useRef } from "react";
import { Circle } from "react-konva";

import { usePageNodeRef } from "@/components/editor/canvas-context";
import {
  collectSnapTargets,
  isFreeMove,
} from "@/components/editor/canvas/snap-targets";
import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import type { Point, Rect } from "@/lib/document/geometry";
import type { LinearElement } from "@/lib/document/schema";
import { updateElement } from "@/lib/editor/document-ops";
import { SNAP_DISTANCE_PX, snapPoint } from "@/lib/editor/snapping";
import { selectDocument } from "@/lib/editor/store";

const HANDLE_RADIUS = 7;
const ACCENT = "#2563eb";

// Endpoint handles for lines/arrows (a Transformer would distort them).
// Rendered in page coordinates; one drag is one undo step. Endpoints snap to
// other elements, the page, and the line's other end (straight lines).
export const LineHandles = ({
  element,
  zoom,
}: {
  element: LinearElement;
  zoom: number;
}) => {
  const store = useEditorStoreApi();
  const pageNodeRef = usePageNodeRef();
  const targetsRef = useRef<Rect[] | null>(null);
  const [x1, y1, x2, y2] = element.points;

  const handles = [
    { index: 0 as const, x: element.x + x1, y: element.y + y1 },
    { index: 1 as const, x: element.x + x2, y: element.y + y2 },
  ];

  const moveEndpoint =
    (index: 0 | 1) => (event: Konva.KonvaEventObject<DragEvent>) => {
      const local = {
        x: event.target.x() - element.x,
        y: event.target.y() - element.y,
      };
      const points: LinearElement["points"] =
        index === 0 ? [local.x, local.y, x2, y2] : [x1, y1, local.x, local.y];
      store
        .getState()
        .change((doc) => updateElement(doc, element.id, { points }));
    };

  const startDrag = (index: 0 | 1) => () => {
    store.getState().begin();
    const page = pageNodeRef.current;
    const otherEnd = handles[index === 0 ? 1 : 0];
    if (page && otherEnd) {
      targetsRef.current = [
        ...collectSnapTargets(
          page,
          selectDocument(store.getState()),
          new Set([element.id])
        ),
        { height: 0, width: 0, x: otherEnd.x, y: otherEnd.y },
      ];
    }
  };

  const endDrag = () => {
    store.getState().end();
    targetsRef.current = null;
    store.getState().setGuides([]);
  };

  // Konva asks where a dragged handle may go (in stage pixels)
  const boundEndpoint = (position: Point, event: unknown): Point => {
    const page = pageNodeRef.current;
    const targets = targetsRef.current;
    if (!(page && targets) || isFreeMove(event)) {
      store.getState().setGuides([]);
      return position;
    }
    const toStage = page.getAbsoluteTransform();
    const point = toStage.copy().invert().point(position);
    const snap = snapPoint(point, targets, SNAP_DISTANCE_PX / page.scaleX());
    store.getState().setGuides(snap.guides);
    return toStage.point({ x: point.x + snap.dx, y: point.y + snap.dy });
  };

  return (
    <>
      {handles.map((handle) => (
        <Circle
          key={handle.index}
          x={handle.x}
          y={handle.y}
          radius={HANDLE_RADIUS / zoom}
          fill="#ffffff"
          stroke={ACCENT}
          strokeWidth={2 / zoom}
          draggable
          dragBoundFunc={boundEndpoint}
          onDragStart={startDrag(handle.index)}
          onDragMove={moveEndpoint(handle.index)}
          onDragEnd={endDrag}
        />
      ))}
    </>
  );
};
