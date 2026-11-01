"use client";

// Konva's Label is a tag and its text, not a form label
import { Group, Label as Badge, Line, Tag, Text } from "react-konva";

import { useEditor } from "@/components/editor/editor-store-context";
import type { Point } from "@/lib/document/geometry";
import type { SnapGuide } from "@/lib/editor/snapping";

const GUIDE_COLOR = "#ff2e93";
const TICK = 4;
const LABEL_OFFSET = 14;

// A measured equal space: the span with a tick at each end and its length
const GapMark = ({ guide, points }: { guide: SnapGuide; points: number[] }) => {
  const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = points;
  const horizontal = guide.axis === "y";
  const tick = (x: number, y: number) =>
    horizontal ? [x, y - TICK, x, y + TICK] : [x - TICK, y, x + TICK, y];
  const middle = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };

  return (
    <Group listening={false}>
      <Line points={points} stroke={GUIDE_COLOR} strokeWidth={1} />
      <Line points={tick(x1, y1)} stroke={GUIDE_COLOR} strokeWidth={1} />
      <Line points={tick(x2, y2)} stroke={GUIDE_COLOR} strokeWidth={1} />
      <Badge
        x={horizontal ? middle.x : middle.x + LABEL_OFFSET}
        y={horizontal ? middle.y - LABEL_OFFSET : middle.y}
      >
        <Tag
          fill={GUIDE_COLOR}
          cornerRadius={4}
          pointerDirection={horizontal ? "down" : "left"}
          pointerWidth={0}
          pointerHeight={0}
        />
        <Text
          text={String(Math.round(guide.to - guide.from))}
          fill="#ffffff"
          fontSize={11}
          padding={3}
        />
      </Badge>
    </Group>
  );
};

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
    const points = guide.axis === "x" ? [at, from, at, to] : [from, at, to, at];
    const key = `${guide.gap ? "gap" : "line"}:${guide.axis}:${guide.at}:${guide.from}`;
    return guide.gap ? (
      <GapMark key={key} guide={guide} points={points} />
    ) : (
      <Line
        key={key}
        points={points}
        stroke={GUIDE_COLOR}
        strokeWidth={1}
        listening={false}
      />
    );
  });
};
