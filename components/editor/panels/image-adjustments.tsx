"use client";

import { RiResetLeftLine } from "@remixicon/react";

import { PanelSection } from "@/components/editor/panels/panel-section";
import { TransactionSlider } from "@/components/editor/panels/transaction-slider";
import { Button } from "@/components/ui/button";
import { useUpdateElement } from "@/hooks/use-selected-element";
import type { ImageElement } from "@/lib/document/schema";
import {
  ADJUSTMENTS,
  ADJUSTMENT_MAX,
  ADJUSTMENT_ORDER,
  NEUTRAL_ADJUSTMENTS,
} from "@/lib/image-filters/adjustments";
import {
  hasAdjustments,
  withAdjustment,
  withoutAdjustments,
} from "@/lib/image-filters/edit";

const signed = (value: number) => {
  if (value > 0) {
    return `+${value}`;
  }
  return value < 0 ? `−${-value}` : "0";
};

// Instagram-style sliders on top of any preset; one scrub is one undo step
export const ImageAdjustments = ({ element }: { element: ImageElement }) => {
  const update = useUpdateElement(element.id);
  const { filter } = element;
  const adjust = filter?.adjust ?? NEUTRAL_ADJUSTMENTS;

  return (
    <PanelSection
      title="Adjust"
      action={
        <Button
          variant="ghost"
          size="xs"
          aria-label="Reset adjustments"
          disabled={!hasAdjustments(filter)}
          onClick={() => update({ filter: withoutAdjustments(filter) })}
        >
          <RiResetLeftLine data-icon="inline-start" />
          Reset
        </Button>
      }
    >
      {ADJUSTMENT_ORDER.map((key) => {
        const { label, min } = ADJUSTMENTS[key];
        return (
          <TransactionSlider
            key={key}
            label={label}
            value={adjust[key]}
            min={min}
            max={ADJUSTMENT_MAX}
            format={min < 0 ? signed : String}
            onChange={(value) =>
              update({ filter: withAdjustment(filter, key, value) })
            }
          />
        );
      })}
    </PanelSection>
  );
};
