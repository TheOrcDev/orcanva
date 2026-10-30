"use client";

import { RiArrowLeftRightLine } from "@remixicon/react";

import { ColorPicker } from "@/components/editor/panels/color-picker";
import { PanelSection } from "@/components/editor/panels/panel-section";
import { TransactionSlider } from "@/components/editor/panels/transaction-slider";
import { Button } from "@/components/ui/button";
import { useUpdateElement } from "@/hooks/use-selected-element";
import type { LinearElement } from "@/lib/document/schema";

export const LineProperties = ({ element }: { element: LinearElement }) => {
  const update = useUpdateElement(element.id);
  const [x1, y1, x2, y2] = element.points;

  return (
    <PanelSection title={element.type === "arrow" ? "Arrow" : "Line"}>
      <ColorPicker
        label="Line color"
        value={element.stroke}
        onChange={(stroke) => update({ stroke })}
      />
      <TransactionSlider
        label="Thickness"
        value={element.strokeWidth}
        min={1}
        max={80}
        format={(value) => `${value}px`}
        onChange={(strokeWidth) => update({ strokeWidth })}
      />
      {element.type === "arrow" ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => update({ points: [x2, y2, x1, y1] })}
        >
          <RiArrowLeftRightLine data-icon="inline-start" />
          Reverse direction
        </Button>
      ) : null}
    </PanelSection>
  );
};
