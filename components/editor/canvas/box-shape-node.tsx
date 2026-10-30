"use client";

import type Konva from "konva";
import { Rect, Shape } from "react-konva";

import type { BoxShapeElement } from "@/lib/document/schema";

// Ellipses are drawn inside their box so they share Rect's top-left model
const drawEllipse = (context: Konva.Context, shape: Konva.Shape) => {
  const width = shape.width();
  const height = shape.height();
  context.beginPath();
  context.ellipse(
    width / 2,
    height / 2,
    width / 2,
    height / 2,
    0,
    0,
    Math.PI * 2
  );
  context.closePath();
  context.fillStrokeShape(shape);
};

export const BoxShapeNode = ({ element }: { element: BoxShapeElement }) => {
  const shared = {
    fill: element.fill,
    height: element.height,
    perfectDrawEnabled: false,
    stroke: element.stroke,
    strokeEnabled: element.strokeWidth > 0,
    strokeWidth: element.strokeWidth,
    width: element.width,
  };

  if (element.type === "ellipse") {
    return <Shape {...shared} sceneFunc={drawEllipse} />;
  }
  return <Rect {...shared} cornerRadius={element.cornerRadius} />;
};
