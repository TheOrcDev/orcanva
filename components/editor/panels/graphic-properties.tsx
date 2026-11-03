"use client";

import { RiFlipHorizontalLine, RiFlipVerticalLine } from "@remixicon/react";

import { PanelSection } from "@/components/editor/panels/panel-section";
import { Button } from "@/components/ui/button";
import { useUpdateElement } from "@/hooks/use-selected-element";
import type { GraphicElement } from "@/lib/document/schema";

export const GraphicProperties = ({ element }: { element: GraphicElement }) => {
  const update = useUpdateElement(element.id);

  return (
    <PanelSection title="Graphic">
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="sm"
          aria-pressed={element.flipX}
          onClick={() => update({ flipX: !element.flipX })}
        >
          <RiFlipHorizontalLine data-icon="inline-start" />
          Flip H
        </Button>
        <Button
          variant="outline"
          size="sm"
          aria-pressed={element.flipY}
          onClick={() => update({ flipY: !element.flipY })}
        >
          <RiFlipVerticalLine data-icon="inline-start" />
          Flip V
        </Button>
      </div>
    </PanelSection>
  );
};
