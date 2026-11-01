"use client";

import type Konva from "konva";
import { useEffect, useRef } from "react";
import { Transformer } from "react-konva";

import { usePageNodeRef } from "@/components/editor/canvas-context";
import {
  collectSnapTargets,
  isFreeMove,
} from "@/components/editor/canvas/snap-targets";
import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import type { Point, Rect } from "@/lib/document/geometry";
import type { DesignElement } from "@/lib/document/schema";
import type { NodeTransform } from "@/lib/editor/bake";
import { SNAP_DISTANCE_PX, snapResize } from "@/lib/editor/snapping";
import { selectDocument } from "@/lib/editor/store";

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

// Mirrors how Konva decides whether a corner keeps the box's ratio
const keepsProportion = (transformer: Konva.Transformer, event: unknown) => {
  const shift = event instanceof MouseEvent && event.shiftKey;
  switch (transformer.shiftBehavior()) {
    case "inverted": {
      return transformer.keepRatio() && !shift;
    }
    case "none": {
      return transformer.keepRatio();
    }
    default: {
      return transformer.keepRatio() || shift;
    }
  }
};

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
  const pageNodeRef = usePageNodeRef();
  const store = useEditorStoreApi();
  // What the handles snap to, measured when a resize starts
  const targetsRef = useRef<Rect[] | null>(null);

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
    targetsRef.current = null;
    store.getState().setGuides([]);
    // Scale is baked into the element; the node goes back to scale 1
    node.scale({ x: 1, y: 1 });
    onTransformEnd(element, transform, node);
  };

  // Konva asks where a dragged handle may go (in stage pixels)
  const snapAnchor = (_previous: Point, next: Point, event: unknown): Point => {
    const transformer = transformerRef.current;
    const page = pageNodeRef.current;
    const targets = targetsRef.current;
    const anchor = transformer?.getActiveAnchor();
    // Snapping lines up axis-aligned edges; turned boxes resize freely
    const turned = Math.abs(transformer?.rotation() ?? 0) > 0.01;
    if (
      !(transformer && page && targets && anchor) ||
      anchor === "rotater" ||
      turned ||
      isFreeMove(event)
    ) {
      store.getState().setGuides([]);
      return next;
    }
    const toStage = page.getAbsoluteTransform();
    const toPage = toStage.copy().invert();
    const corner = (name: string) =>
      toPage.point(
        transformer.findOne(`.${name}`)?.getAbsolutePosition() ?? next
      );
    const topLeft = corner("top-left");
    const bottomRight = corner("bottom-right");
    const result = snapResize({
      anchor,
      box: {
        height: bottomRight.y - topLeft.y,
        width: bottomRight.x - topLeft.x,
        x: topLeft.x,
        y: topLeft.y,
      },
      distance: SNAP_DISTANCE_PX / page.scaleX(),
      keepRatio: keepsProportion(transformer, event),
      point: toPage.point(next),
      targets,
    });
    store.getState().setGuides(result.guides);
    return toStage.point(result.point);
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
      anchorDragBoundFunc={snapAnchor}
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
        const page = pageNodeRef.current;
        if (element && page) {
          targetsRef.current = collectSnapTargets(
            page,
            selectDocument(store.getState()),
            new Set([element.id])
          );
        }
        if (element) {
          onTransformStart(element);
        }
      }}
      onTransformEnd={handleTransformEnd}
    />
  );
};
