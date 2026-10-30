"use client";

import { Rect } from "react-konva";

import { gradientPoints } from "@/lib/document/geometry";
import type { Background } from "@/lib/document/schema";

export const BackgroundNode = ({
  background,
  width,
  height,
  onSelectPage,
}: {
  background: Background;
  width: number;
  height: number;
  onSelectPage: () => void;
}) => {
  const size = { height, width };

  if (background.type === "solid") {
    return (
      <Rect
        width={width}
        height={height}
        fill={background.color}
        onMouseDown={onSelectPage}
        onTap={onSelectPage}
      />
    );
  }

  const { end, start } = gradientPoints(background.angle, size);
  const stops = [...background.stops]
    .toSorted((a, b) => a.offset - b.offset)
    .flatMap((stop) => [stop.offset, stop.color]);

  return (
    <Rect
      width={width}
      height={height}
      fillLinearGradientStartPoint={start}
      fillLinearGradientEndPoint={end}
      fillLinearGradientColorStops={stops}
      onMouseDown={onSelectPage}
      onTap={onSelectPage}
    />
  );
};
