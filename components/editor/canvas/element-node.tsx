"use client";

import type Konva from "konva";
import { Group } from "react-konva";

import { BoxShapeNode } from "@/components/editor/canvas/box-shape-node";
import { ImageNode } from "@/components/editor/canvas/image-node";
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
  isEditing: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, position: { x: number; y: number }) => void;
  onEditText: (id: string) => void;
}

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
  isEditing,
  onSelect,
  onMove,
  onEditText,
}: ElementNodeProps) => {
  const isText = element.type === "text";
  const select = () => onSelect(element.id);
  const handleDragEnd = (event: Konva.KonvaEventObject<DragEvent>) => {
    onMove(element.id, { x: event.target.x(), y: event.target.y() });
  };
  const editText = () => {
    if (isText && !element.locked) {
      onEditText(element.id);
    }
  };

  return (
    <Group
      id={element.id}
      name={ELEMENT_NODE_NAME}
      x={element.x}
      y={element.y}
      rotation={element.rotation}
      opacity={element.opacity}
      visible={element.visible && !isEditing}
      draggable={!element.locked}
      onMouseDown={select}
      onTap={select}
      onDragStart={select}
      onDragEnd={handleDragEnd}
      onDblClick={editText}
      onDblTap={editText}
      onTransform={isText ? rewrapText : undefined}
    >
      <ElementContent element={element} />
    </Group>
  );
};
