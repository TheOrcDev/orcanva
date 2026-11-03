"use client";

import Konva from "konva";
import { useEffect, useRef } from "react";
import { Group } from "react-konva";

import { BoxShapeNode } from "@/components/editor/canvas/box-shape-node";
import { FrameNode } from "@/components/editor/canvas/frame-node";
import { GraphicNode } from "@/components/editor/canvas/graphic-node";
import { ImageNode } from "@/components/editor/canvas/image-node";
import { LineNode } from "@/components/editor/canvas/line-node";
import { SELECTION_HANDLES_NAME } from "@/components/editor/canvas/selection-transformer";
import {
  HIGHLIGHT_NODE_NAME,
  TEXT_BODY_NAME,
  TextNode,
  layoutHighlight,
  textLayoutOf,
} from "@/components/editor/canvas/text-node";
import { cropToPixels } from "@/lib/document/crop";
import type {
  DesignElement,
  ImageCrop,
  ImageElement,
} from "@/lib/document/schema";
import { MIN_ELEMENT_SIZE, cropToEdge, edgeOfAnchor } from "@/lib/editor/bake";
import {
  ELEMENT_NODE_NAME,
  LIVE_CROP_ATTR,
  PHOTO_EFFECTS_NAME,
  photoNodeOf,
} from "@/lib/editor/node-names";

interface Position {
  x: number;
  y: number;
}

export interface ElementNodeProps {
  element: DesignElement;
  // Pointer down on the element; `additive` when Shift is held
  onPress: (id: string, additive: boolean) => void;
  // Released without dragging
  onClick: (id: string, additive: boolean) => void;
  onEditText: (id: string) => void;
  // Double-click on an image
  onCrop: (id: string) => void;
  onDragStart: (id: string) => void;
  onDragMove: (id: string) => void;
  onDragEnd: (id: string, position: Position) => void;
  // Where the dragged node may go, in stage pixels (snapping)
  onDragBound: (id: string, position: Position, event: unknown) => Position;
  // Someone else is dragging this element right now
  preview: { x: number; y: number } | null;
}

// Others' drag positions arrive about every 100 ms; gliding hides the steps
const PREVIEW_GLIDE_SECONDS = 0.1;

const ElementContent = ({ element }: { element: DesignElement }) => {
  switch (element.type) {
    case "rect":
    case "ellipse": {
      return <BoxShapeNode element={element} />;
    }
    case "image": {
      return <ImageNode element={element} />;
    }
    case "frame": {
      return <FrameNode element={element} />;
    }
    case "text": {
      return <TextNode element={element} />;
    }
    case "line":
    case "arrow": {
      return <LineNode element={element} />;
    }
    case "graphic": {
      return <GraphicNode element={element} />;
    }
    default: {
      return null;
    }
  }
};

const SIDE_ANCHORS = new Set(["middle-left", "middle-right"]);

// The handle the selection is being resized by
const activeAnchor = (node: Konva.Node): string | null =>
  node
    .getStage()
    ?.findOne<Konva.Transformer>(`.${SELECTION_HANDLES_NAME}`)
    ?.getActiveAnchor() ?? null;

// Side handles on text change the wrap width instead of squashing glyphs:
// fold the horizontal scale into the Text width while the drag is live.
const rewrapText = (event: Konva.KonvaEventObject<Event>) => {
  const group = event.currentTarget as Konva.Group;
  if (!SIDE_ANCHORS.has(activeAnchor(group) ?? "")) {
    return;
  }
  const text = group.findOne(`.${TEXT_BODY_NAME}`);
  if (!text) {
    return;
  }
  const width = Math.max(MIN_ELEMENT_SIZE, text.width() * group.scaleX());
  group.scaleX(1);
  text.width(width);
  text.height(textLayoutOf(text).height);
  const highlight = group.findOne(`.${HIGHLIGHT_NODE_NAME}`);
  if (highlight) {
    layoutHighlight(text, highlight);
  }
};

export interface LiveCrop {
  crop: ImageCrop | null;
  width: number;
  height: number;
}

// Side handles on a photo crop it instead of stretching it: fold the scale
// into the photo's size and crop while the drag is live. `element` is the
// photo as the gesture started. Its effects hide until the crop is baked
// (see PhotoEffectsNode), but their node follows the box: the Transformer
// measures the whole element, so a node left at the old size would scale
// every next step from the wrong width.
const recropImage = (
  event: Konva.KonvaEventObject<Event>,
  element: ImageElement
) => {
  const group = event.currentTarget as Konva.Group;
  const edge = edgeOfAnchor(activeAnchor(group));
  const image = photoNodeOf(group);
  const source = image?.image();
  // The photo, or its filtered copy (see useFilteredImage)
  const drawn =
    source instanceof HTMLImageElement || source instanceof HTMLCanvasElement
      ? source
      : null;
  if (!(edge && image && drawn)) {
    return;
  }
  const horizontal = edge === "left" || edge === "right";
  const size = horizontal
    ? image.width() * Math.abs(group.scaleX())
    : image.height() * Math.abs(group.scaleY());
  const { crop, size: allowed } = cropToEdge(element, edge, size);
  const width = horizontal ? allowed : image.width();
  const height = horizontal ? image.height() : allowed;
  group.scale({ x: 1, y: 1 });
  image.width(width);
  image.height(height);
  image.position({
    x: element.flipX ? width : 0,
    y: element.flipY ? height : 0,
  });
  image.crop(cropToPixels(crop, { height: drawn.height, width: drawn.width }));
  group.findOne(`.${PHOTO_EFFECTS_NAME}`)?.size({ height, width });
  const live: LiveCrop = { crop, height, width };
  image.setAttr(LIVE_CROP_ATTR, live);
};

// Every element is a Group positioned at its top-left corner. The Group is
// what drags and what the Transformer scales; scale is baked on release.
export const ElementNode = ({
  element,
  onPress,
  onClick,
  onEditText,
  onCrop,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragBound,
  preview,
}: ElementNodeProps) => {
  const isText = element.type === "text";
  const groupRef = useRef<Konva.Group>(null);
  const previewX = preview?.x;
  const previewY = preview?.y;
  const { x: elementX, y: elementY } = element;

  // Show someone else's drag as it happens, then settle on the committed
  // position once their preview ends
  useEffect(() => {
    const group = groupRef.current;
    if (!group || group.isDragging()) {
      return;
    }
    if (previewX === undefined || previewY === undefined) {
      group.position({ x: elementX, y: elementY });
      return;
    }
    const tween = new Konva.Tween({
      duration: PREVIEW_GLIDE_SECONDS,
      easing: Konva.Easings.Linear,
      node: group,
      x: previewX,
      y: previewY,
    });
    tween.play();
    return () => tween.destroy();
  }, [previewX, previewY, elementX, elementY]);

  const handleDragEnd = (event: Konva.KonvaEventObject<DragEvent>) => {
    onDragEnd(element.id, { x: event.target.x(), y: event.target.y() });
  };
  const edit = () => {
    if (element.locked) {
      return;
    }
    if (isText) {
      onEditText(element.id);
    } else if (
      element.type === "image" ||
      (element.type === "frame" && element.assetId)
    ) {
      onCrop(element.id);
    }
  };

  return (
    <Group
      ref={groupRef}
      id={element.id}
      name={ELEMENT_NODE_NAME}
      x={element.x}
      y={element.y}
      rotation={element.rotation}
      opacity={element.opacity}
      visible={element.visible}
      draggable={!element.locked}
      dragBoundFunc={(position, event) =>
        onDragBound(element.id, position, event)
      }
      onMouseDown={(event) => onPress(element.id, event.evt.shiftKey)}
      onTouchStart={() => onPress(element.id, false)}
      onClick={(event) => onClick(element.id, event.evt.shiftKey)}
      onTap={() => onClick(element.id, false)}
      onDragStart={() => onDragStart(element.id)}
      onDragMove={() => onDragMove(element.id)}
      onDragEnd={handleDragEnd}
      onDblClick={edit}
      onDblTap={edit}
      onTransform={(event) => {
        if (element.type === "text") {
          rewrapText(event);
        } else if (element.type === "image") {
          recropImage(event, element);
        }
      }}
    >
      <ElementContent element={element} />
    </Group>
  );
};
