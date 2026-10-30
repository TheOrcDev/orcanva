"use client";

import {
  RiArrowRightLine,
  RiCheckboxBlankCircleLine,
  RiCheckboxBlankLine,
  RiSubtractLine,
} from "@remixicon/react";
import type { RemixiconComponentType } from "@remixicon/react";

import { PanelSection } from "@/components/editor/panels/panel-section";
import { Button } from "@/components/ui/button";
import { useInsertElement } from "@/hooks/use-insert-element";
import {
  createBoxElement,
  createLinearElement,
} from "@/lib/document/factories";
import type { Size } from "@/lib/document/geometry";
import type { DesignElement } from "@/lib/document/schema";

interface ShapeOption {
  label: string;
  icon: RemixiconComponentType;
  build: (page: Size) => DesignElement;
}

const SHAPES: ShapeOption[] = [
  {
    build: (page) => createBoxElement("rect", page),
    icon: RiCheckboxBlankLine,
    label: "Rectangle",
  },
  {
    build: (page) => createBoxElement("ellipse", page),
    icon: RiCheckboxBlankCircleLine,
    label: "Ellipse",
  },
  {
    build: (page) => createLinearElement("line", page),
    icon: RiSubtractLine,
    label: "Line",
  },
  {
    build: (page) => createLinearElement("arrow", page),
    icon: RiArrowRightLine,
    label: "Arrow",
  },
];

export const ShapesPanel = () => {
  const insert = useInsertElement();

  return (
    <PanelSection title="Shapes">
      <div className="grid grid-cols-2 gap-2">
        {SHAPES.map((shape) => (
          <Button
            key={shape.label}
            variant="outline"
            className="h-20 flex-col"
            onClick={() => insert(shape.build)}
          >
            <shape.icon />
            {shape.label}
          </Button>
        ))}
      </div>
    </PanelSection>
  );
};
