"use client";

import { Rect } from "react-konva";

import { gradientPoints } from "@/lib/document/geometry";
import type { Background } from "@/lib/document/schema";
import { BACKGROUND_NODE_NAME } from "@/lib/editor/node-names";

// Presses on the background reach the stage, which clears the selection or
// starts a selection box
export const BackgroundNode = ({
  background,
  width,
  height,
}: {
  background: Background;
  width: number;
  height: number;
}) => {
  const size = { height, width };

  if (background.type === "solid") {
    return (
      <Rect
        name={BACKGROUND_NODE_NAME}
        width={width}
        height={height}
        fill={background.color}
      />
    );
  }

  const { end, start } = gradientPoints(background.angle, size);
  const stops = [...background.stops]
    .toSorted((a, b) => a.offset - b.offset)
    .flatMap((stop) => [stop.offset, stop.color]);

  return (
    <Rect
      name={BACKGROUND_NODE_NAME}
      width={width}
      height={height}
      fillLinearGradientStartPoint={start}
      fillLinearGradientEndPoint={end}
      fillLinearGradientColorStops={stops}
    />
  );
};
