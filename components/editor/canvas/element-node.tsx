"use client";

import type Konva from "konva";
import { Group } from "react-konva";

import { BoxShapeNode } from "@/components/editor/canvas/box-shape-node";
import type { DesignElement } from "@/lib/document/schema";
import { ELEMENT_NODE_NAME } from "@/lib/editor/node-names";

export interface ElementNodeProps {
  element: DesignElement;
  isEditing: boolean;
  onSelect: (id: string) => void;
  onMove: (id: string, position: { x: number; y: number }) => void;
}

const ElementContent = ({ element }: { element: DesignElement }) => {
  switch (element.type) {
    case "rect":
    case "ellipse": {
      return <BoxShapeNode element={element} />;
    }
    default: {
      return null;
    }
  }
};

// Every element is a Group positioned at its top-left corner. The Group is
// what drags and what the Transformer scales; scale is baked on release.
export const ElementNode = ({
  element,
  isEditing,
  onSelect,
  onMove,
}: ElementNodeProps) => {
  const select = () => onSelect(element.id);
  const handleDragEnd = (event: Konva.KonvaEventObject<DragEvent>) => {
    onMove(element.id, { x: event.target.x(), y: event.target.y() });
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
    >
      <ElementContent element={element} />
    </Group>
  );
};
