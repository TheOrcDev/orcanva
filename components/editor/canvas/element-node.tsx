"use client";

import Konva from "konva";
import { useEffect, useRef } from "react";
import { Group } from "react-konva";

import { BoxShapeNode } from "@/components/editor/canvas/box-shape-node";
import { ImageNode } from "@/components/editor/canvas/image-node";
import { LineNode } from "@/components/editor/canvas/line-node";
import {
  HIGHLIGHT_NODE_NAME,
  TextNode,
  layoutHighlight,
} from "@/components/editor/canvas/text-node";
import type { DesignElement } from "@/lib/document/schema";
import { MIN_ELEMENT_SIZE } from "@/lib/editor/bake";
import { ELEMENT_NODE_NAME } from "@/lib/editor/node-names";

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
    case "text": {
      return <TextNode element={element} />;
    }
    case "line":
    case "arrow": {
      return <LineNode element={element} />;
    }
    default: {
      return null;
    }
  }
};

const SIDE_ANCHORS = new Set(["middle-left", "middle-right"]);

// Side handles on text change the wrap width instead of squashing glyphs:
// fold the horizontal scale into the Text width while the drag is live.
const rewrapText = (event: Konva.KonvaEventObject<Event>) => {
  const group = event.currentTarget as Konva.Group;
  const transformer = group.getStage()?.findOne("Transformer") as
    | Konva.Transformer
    | undefined;
  if (!SIDE_ANCHORS.has(transformer?.getActiveAnchor() ?? "")) {
    return;
  }
  const text = group.findOne("Text");
  if (!text) {
    return;
  }
  const width = Math.max(MIN_ELEMENT_SIZE, text.width() * group.scaleX());
  group.scaleX(1);
  text.width(width);
  const highlight = group.findOne(`.${HIGHLIGHT_NODE_NAME}`);
  if (highlight) {
    layoutHighlight(text as Konva.Text, highlight);
  }
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
    } else if (element.type === "image") {
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
      onTransform={isText ? rewrapText : undefined}
    >
      <ElementContent element={element} />
    </Group>
  );
};
