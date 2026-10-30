"use client";

import { ColorPicker } from "@/components/editor/panels/color-picker";
import { PanelSection } from "@/components/editor/panels/panel-section";
import { TransactionSlider } from "@/components/editor/panels/transaction-slider";
import { useUpdateElement } from "@/hooks/use-selected-element";
import type { BoxShapeElement } from "@/lib/document/schema";

export const BoxShapeProperties = ({
  element,
}: {
  element: BoxShapeElement;
}) => {
  const update = useUpdateElement(element.id);
  const maxRadius = Math.round(Math.min(element.width, element.height) / 2);

  return (
    <>
      <PanelSection title="Fill">
        <ColorPicker
          label="Fill color"
          value={element.fill}
          onChange={(fill) => update({ fill })}
        />
      </PanelSection>
      <PanelSection title="Stroke">
        <ColorPicker
          label="Stroke color"
          value={element.stroke}
          onChange={(stroke) => update({ stroke })}
        />
        <TransactionSlider
          label="Width"
          value={element.strokeWidth}
          min={0}
          max={100}
          format={(value) => `${value}px`}
          onChange={(strokeWidth) => update({ strokeWidth })}
        />
      </PanelSection>
      {element.type === "rect" ? (
        <PanelSection title="Corners">
          <TransactionSlider
            label="Radius"
            value={Math.min(element.cornerRadius, maxRadius)}
            min={0}
            max={Math.max(1, maxRadius)}
            format={(value) => `${value}px`}
            onChange={(cornerRadius) => update({ cornerRadius })}
          />
        </PanelSection>
      ) : null}
    </>
  );
};
