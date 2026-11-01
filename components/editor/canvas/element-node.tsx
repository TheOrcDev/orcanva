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

export interface ElementNodeProps {
  element: DesignElement;
  onSelect: (id: string) => void;
  onMove: (id: string, position: { x: number; y: number }) => void;
  onEditText: (id: string) => void;
  // A drag started / ended: remote updates to the element wait meanwhile
  onHold: (id: string) => void;
  onRelease: (id: string) => void;
  // Reports the in-progress drag so others can watch it move
  onDragPreview: (id: string, position: { x: number; y: number }) => void;
  // Where the dragged node may go, in stage pixels (snapping)
  onDragBound: (
    id: string,
    position: { x: number; y: number },
    event: unknown
  ) => { x: number; y: number };
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
  onSelect,
  onMove,
  onEditText,
  onHold,
  onRelease,
  onDragPreview,
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

  const select = () => onSelect(element.id);
  const handleDragStart = () => {
    select();
    onHold(element.id);
  };
  const handleDragMove = (event: Konva.KonvaEventObject<DragEvent>) => {
    onDragPreview(element.id, { x: event.target.x(), y: event.target.y() });
  };
  const handleDragEnd = (event: Konva.KonvaEventObject<DragEvent>) => {
    onMove(element.id, { x: event.target.x(), y: event.target.y() });
    onRelease(element.id);
  };
  const editText = () => {
    if (isText && !element.locked) {
      onEditText(element.id);
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
      onMouseDown={select}
      onTap={select}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
      onDblClick={editText}
      onDblTap={editText}
      onTransform={isText ? rewrapText : undefined}
    >
      <ElementContent element={element} />
    </Group>
  );
};
