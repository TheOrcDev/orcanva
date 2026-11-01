"use client";

import { Line } from "react-konva";

import { useEditor } from "@/components/editor/editor-store-context";
import type { Point } from "@/lib/document/geometry";

const GUIDE_COLOR = "#ff2e93";

// Drawn in screen pixels so guides stay one pixel wide at any zoom
export const SnapGuides = ({
  origin,
  zoom,
}: {
  origin: Point;
  zoom: number;
}) => {
  const guides = useEditor((state) => state.guides);

  return guides.map((guide) => {
    const at = (guide.axis === "x" ? origin.x : origin.y) + guide.at * zoom;
    const across = guide.axis === "x" ? origin.y : origin.x;
    const from = across + guide.from * zoom;
    const to = across + guide.to * zoom;
    return (
      <Line
        key={`${guide.axis}:${guide.at}`}
        points={guide.axis === "x" ? [at, from, at, to] : [from, at, to, at]}
        stroke={GUIDE_COLOR}
        strokeWidth={1}
        listening={false}
      />
    );
  });
};
