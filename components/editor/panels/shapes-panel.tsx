"use client";

import {
  RiArrowRightLine,
  RiCheckboxBlankCircleLine,
  RiCheckboxBlankLine,
  RiSubtractLine,
} from "@remixicon/react";
import type { RemixiconComponentType } from "@remixicon/react";

import { GraphicTile } from "@/components/editor/panels/graphic-tile";
import { PanelSection } from "@/components/editor/panels/panel-section";
import { Button } from "@/components/ui/button";
import { useInsertElement } from "@/hooks/use-insert-element";
import {
  createBoxElement,
  createFrameElement,
  createLinearElement,
} from "@/lib/document/factories";
import { FRAME_SHAPES } from "@/lib/document/frame-shapes";
import type { Size } from "@/lib/document/geometry";
import type { DesignElement } from "@/lib/document/schema";
import { BUILTIN_GRAPHICS } from "@/lib/graphics/builtin";

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
    <>
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
      <PanelSection title="Frames">
        <div className="grid grid-cols-3 gap-2">
          {FRAME_SHAPES.map((shape) => (
            <Button
              key={shape.id}
              variant="outline"
              className="h-20 flex-col"
              aria-label={`${shape.label} frame`}
              onClick={() =>
                insert((page) => createFrameElement(page, shape.id))
              }
            >
              <svg viewBox="0 0 1 1" className="size-8" aria-hidden>
                <path d={shape.path} className="fill-muted-foreground/40" />
              </svg>
              <span className="text-xs">{shape.label}</span>
            </Button>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">
          Drop a photo onto a frame to fill it.
        </p>
      </PanelSection>
      <PanelSection title="Stickers">
        <ul className="grid grid-cols-4 gap-2" aria-label="Stickers">
          {BUILTIN_GRAPHICS.map((graphic) => (
            <li key={graphic.id}>
              <GraphicTile graphic={graphic} />
            </li>
          ))}
        </ul>
      </PanelSection>
    </>
  );
};
