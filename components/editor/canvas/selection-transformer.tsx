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
import type { DesignElement, ImageElement } from "@/lib/document/schema";
import { edgeOfAnchor, roomToEdge } from "@/lib/editor/bake";
import type { NodeTransform } from "@/lib/editor/bake";
import { SNAP_DISTANCE_PX, snapResize } from "@/lib/editor/snapping";
import { selectDocument } from "@/lib/editor/store";

// Other code finds the selection's handles by this name (there are other
// Transformers on the stage: others' selections and outlines)
export const SELECTION_HANDLES_NAME = "selection-handles";

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
  if (element.type === "text") {
    // Curved text has no wrap width to change, only a size
    return element.curve === 0 ? TEXT_ANCHORS : CORNER_ANCHORS;
  }
  return ALL_ANCHORS;
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

// What one node's gesture did, for the editor to bake into its element
export interface TransformedElement {
  element: DesignElement;
  transform: NodeTransform;
  node: Konva.Node;
}

interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

// A photo's side handle crops, so it can't pull the frame past the photo's
// own edge. Boxes are in stage pixels and rotate around their top-left
// corner; the side opposite the handle stays put.
const limitToPhoto = (
  box: Box,
  element: ImageElement,
  anchor: string | null,
  zoom: number
): Box => {
  const edge = edgeOfAnchor(anchor);
  if (!edge) {
    return box;
  }
  const room = roomToEdge(element, edge) * zoom;
  const cos = Math.cos(box.rotation);
  const sin = Math.sin(box.rotation);
  if (edge === "left" || edge === "right") {
    const over = box.width - room;
    if (over <= 0) {
      return box;
    }
    const shift = edge === "left" ? over : 0;
    return {
      ...box,
      width: room,
      x: box.x + shift * cos,
      y: box.y + shift * sin,
    };
  }
  const over = box.height - room;
  if (over <= 0) {
    return box;
  }
  const shift = edge === "top" ? over : 0;
  return {
    ...box,
    height: room,
    x: box.x - shift * sin,
    y: box.y + shift * cos,
  };
};

export interface SelectionTransformerProps {
  // One element (lines and arrows alone use endpoint handles instead), or
  // the editable part of a multi-selection
  elements: DesignElement[];
  onTransformStart: (elements: DesignElement[]) => void;
  onTransformEnd: (transformed: TransformedElement[]) => void;
}

export const SelectionTransformer = ({
  elements,
  onTransformStart,
  onTransformEnd,
}: SelectionTransformerProps) => {
  const transformerRef = useRef<Konva.Transformer>(null);
  const pageNodeRef = usePageNodeRef();
  const store = useEditorStoreApi();
  // What the handles snap to, measured when a resize starts
  const targetsRef = useRef<Rect[] | null>(null);
  const [single] = elements.length === 1 ? elements : [];
  const ids = elements.map((element) => element.id).join(" ");

  useEffect(() => {
    const transformer = transformerRef.current;
    const stage = transformer?.getStage();
    if (!(transformer && stage)) {
      return;
    }
    const nodes = ids
      .split(" ")
      .filter(Boolean)
      .map((id) => stage.findOne(`#${id}`))
      .filter((node): node is Konva.Node => node !== undefined);
    transformer.nodes(nodes);
    transformer.getLayer()?.batchDraw();
  }, [ids]);

  const handleTransformEnd = () => {
    const transformed = (transformerRef.current?.nodes() ?? []).flatMap(
      (node) => {
        const element = elements.find((item) => item.id === node.id());
        if (!element) {
          return [];
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
        return [{ element, node, transform }];
      }
    );
    targetsRef.current = null;
    store.getState().setGuides([]);
    onTransformEnd(transformed);
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

  const boundBox = (oldBox: Box, newBox: Box): Box => {
    const limited = limitBox(oldBox, newBox);
    if (single?.type !== "image" || limited === oldBox) {
      return limited;
    }
    return limitToPhoto(
      limited,
      single,
      transformerRef.current?.getActiveAnchor() ?? null,
      pageNodeRef.current?.scaleX() ?? 1
    );
  };

  // A multi-selection holds only editable elements; it scales from its
  // corners, keeping its ratio, so text and lines scale evenly
  const locked = single ? single.locked : elements.length === 0;

  return (
    <Transformer
      ref={transformerRef}
      name={SELECTION_HANDLES_NAME}
      anchorCornerRadius={3}
      anchorFill="#ffffff"
      anchorSize={9}
      anchorStroke={ACCENT}
      borderStroke={ACCENT}
      anchorDragBoundFunc={snapAnchor}
      boundBoxFunc={boundBox}
      enabledAnchors={single ? anchorsFor(single) : CORNER_ANCHORS}
      flipEnabled={false}
      ignoreStroke
      keepRatio={single ? keepsRatio(single) : true}
      resizeEnabled={!locked}
      rotateAnchorOffset={24}
      rotateEnabled={!locked}
      rotationSnapTolerance={4}
      rotationSnaps={ROTATION_SNAPS}
      onTransformStart={() => {
        const page = pageNodeRef.current;
        if (page) {
          targetsRef.current = collectSnapTargets(
            page,
            selectDocument(store.getState()),
            new Set(elements.map((element) => element.id))
          );
        }
        onTransformStart(elements);
      }}
      onTransformEnd={handleTransformEnd}
    />
  );
};
