"use client";

import { Arrow, Line } from "react-konva";

import { useEditor } from "@/components/editor/editor-store-context";
import type { LinearElement } from "@/lib/document/schema";

// Thin lines stay easy to grab at any zoom
const HIT_SCREEN_WIDTH = 16;

export const LineNode = ({ element }: { element: LinearElement }) => {
  const zoom = useEditor((state) => state.zoom);
  const shared = {
    hitStrokeWidth: Math.max(element.strokeWidth, HIT_SCREEN_WIDTH / zoom),
    lineCap: "round" as const,
    lineJoin: "round" as const,
    points: element.points,
    stroke: element.stroke,
    strokeWidth: element.strokeWidth,
  };

  if (element.type === "arrow") {
    return (
      <Arrow
        {...shared}
        fill={element.stroke}
        pointerLength={element.strokeWidth * 3}
        pointerWidth={element.strokeWidth * 3}
      />
    );
  }
  return <Line {...shared} />;
};
