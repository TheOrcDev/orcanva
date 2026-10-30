"use client";

import type Konva from "konva";
import { useEffect, useRef } from "react";
import { Transformer } from "react-konva";

import type { DesignElement } from "@/lib/document/schema";
import type { NodeTransform } from "@/lib/editor/bake";

const ROTATION_SNAPS = [0, 45, 90, 135, 180, 225, 270, 315];
const MIN_SCREEN_SIZE = 8;
const ACCENT = "#2563eb";

const CORNER_ANCHORS = ["top-left", "top-right", "bottom-left", "bottom-right"];
const ALL_ANCHORS = [
  ...CORNER_ANCHORS,
  "top-center",
  "bottom-center",
  "middle-left",
  "middle-right",
];
const TEXT_ANCHORS = [...CORNER_ANCHORS, "middle-left", "middle-right"];

const anchorsFor = (element: DesignElement): string[] => {
  if (element.locked) {
    return [];
  }
  return element.type === "text" ? TEXT_ANCHORS : ALL_ANCHORS;
};

// Images and text keep their ratio (Shift frees it); shapes are free
// (Shift locks it). Konva's default shiftBehavior toggles keepRatio.
const keepsRatio = (element: DesignElement): boolean =>
  element.type === "image" || element.type === "text";

const limitBox = <T extends { width: number; height: number }>(
  oldBox: T,
  newBox: T
): T =>
  Math.abs(newBox.width) < MIN_SCREEN_SIZE ||
  Math.abs(newBox.height) < MIN_SCREEN_SIZE
    ? oldBox
    : newBox;

export interface SelectionTransformerProps {
  // Lines and arrows use endpoint handles instead, so they never arrive here
  element: DesignElement | null;
  onTransformStart: (element: DesignElement) => void;
  onTransformEnd: (
    element: DesignElement,
    transform: NodeTransform,
    node: Konva.Node
  ) => void;
}

export const SelectionTransformer = ({
  element,
  onTransformStart,
  onTransformEnd,
}: SelectionTransformerProps) => {
  const transformerRef = useRef<Konva.Transformer>(null);

  useEffect(() => {
    const transformer = transformerRef.current;
    if (!transformer) {
      return;
    }
    const node = element
      ? transformer.getStage()?.findOne(`#${element.id}`)
      : undefined;
    transformer.nodes(node ? [node] : []);
    transformer.getLayer()?.batchDraw();
  }, [element]);

  const handleTransformEnd = () => {
    const node = transformerRef.current?.nodes()[0];
    if (!node || !element) {
      return;
    }
    const transform: NodeTransform = {
      rotation: node.rotation(),
      scaleX: node.scaleX(),
      scaleY: node.scaleY(),
      x: node.x(),
      y: node.y(),
    };
    // Scale is baked into the element; the node goes back to scale 1
    node.scale({ x: 1, y: 1 });
    onTransformEnd(element, transform, node);
  };

  const locked = element?.locked ?? false;

  return (
    <Transformer
      ref={transformerRef}
      anchorCornerRadius={3}
      anchorFill="#ffffff"
      anchorSize={9}
      anchorStroke={ACCENT}
      borderStroke={ACCENT}
      boundBoxFunc={limitBox}
      enabledAnchors={element ? anchorsFor(element) : []}
      flipEnabled={false}
      ignoreStroke
      keepRatio={element ? keepsRatio(element) : true}
      resizeEnabled={!locked}
      rotateAnchorOffset={24}
      rotateEnabled={!locked}
      rotationSnapTolerance={4}
      rotationSnaps={ROTATION_SNAPS}
      onTransformStart={() => {
        if (element) {
          onTransformStart(element);
        }
      }}
      onTransformEnd={handleTransformEnd}
    />
  );
};
