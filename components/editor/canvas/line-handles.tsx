"use client";

import type Konva from "konva";
import { Circle } from "react-konva";

import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import type { LinearElement } from "@/lib/document/schema";
import { updateElement } from "@/lib/editor/document-ops";

const HANDLE_RADIUS = 7;
const ACCENT = "#2563eb";

// Endpoint handles for lines/arrows (a Transformer would distort them).
// Rendered in page coordinates; one drag is one undo step.
export const LineHandles = ({
  element,
  zoom,
}: {
  element: LinearElement;
  zoom: number;
}) => {
  const store = useEditorStoreApi();
  const [x1, y1, x2, y2] = element.points;

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

  const handles = [
    { index: 0 as const, x: element.x + x1, y: element.y + y1 },
    { index: 1 as const, x: element.x + x2, y: element.y + y2 },
  ];

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
          onDragStart={() => store.getState().begin()}
          onDragMove={moveEndpoint(handle.index)}
          onDragEnd={() => store.getState().end()}
        />
      ))}
    </>
  );
};
