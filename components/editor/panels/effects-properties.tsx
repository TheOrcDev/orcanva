"use client";

import { useId } from "react";
import type { ReactNode } from "react";

import { ColorPicker } from "@/components/editor/panels/color-picker";
import { PanelSection } from "@/components/editor/panels/panel-section";
import { TransactionSlider } from "@/components/editor/panels/transaction-slider";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useUpdateElement } from "@/hooks/use-selected-element";
import type {
  TextElement,
  TextHighlight,
  TextShadow,
  TextStroke,
} from "@/lib/document/schema";

const DEFAULT_STROKE: TextStroke = { color: "#111111", widthEm: 0.05 };
const DEFAULT_SHADOW: TextShadow = {
  blurEm: 0.1,
  color: "#000000b3",
  offsetXEm: 0.03,
  offsetYEm: 0.05,
};
const DEFAULT_HIGHLIGHT: TextHighlight = {
  color: "#ffd60a",
  paddingEm: 0.2,
  radiusEm: 0.12,
};

const percent = (value: number) => `${Math.round(value * 100)}%`;

// Effect sizes are relative to font size; show them as % of the size
const EffectToggle = ({
  title,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  children: ReactNode;
}) => {
  const id = useId();
  return (
    <PanelSection
      title={title}
      action={
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="sr-only">
            {title}
          </Label>
          <Switch id={id} checked={enabled} onCheckedChange={onToggle} />
        </div>
      }
    >
      {enabled ? children : null}
    </PanelSection>
  );
};

export const EffectsProperties = ({ element }: { element: TextElement }) => {
  const update = useUpdateElement(element.id);
  const { highlight, shadow, stroke } = element;

  return (
    <>
      <EffectToggle
        title="Outline"
        enabled={stroke !== null}
        onToggle={(on) => update({ stroke: on ? DEFAULT_STROKE : null })}
      >
        {stroke ? (
          <>
            <ColorPicker
              label="Outline color"
              value={stroke.color}
              onChange={(color) => update({ stroke: { ...stroke, color } })}
            />
            <TransactionSlider
              label="Thickness"
              value={stroke.widthEm}
              min={0}
              max={0.25}
              step={0.005}
              format={percent}
              onChange={(widthEm) => update({ stroke: { ...stroke, widthEm } })}
            />
          </>
        ) : null}
      </EffectToggle>

      <EffectToggle
        title="Shadow"
        enabled={shadow !== null}
        onToggle={(on) => update({ shadow: on ? DEFAULT_SHADOW : null })}
      >
        {shadow ? (
          <>
            <ColorPicker
              label="Shadow color"
              value={shadow.color}
              onChange={(color) => update({ shadow: { ...shadow, color } })}
            />
            <TransactionSlider
              label="Blur"
              value={shadow.blurEm}
              min={0}
              max={1}
              step={0.01}
              format={percent}
              onChange={(blurEm) => update({ shadow: { ...shadow, blurEm } })}
            />
            <TransactionSlider
              label="Offset X"
              value={shadow.offsetXEm}
              min={-0.5}
              max={0.5}
              step={0.01}
              format={percent}
              onChange={(offsetXEm) =>
                update({ shadow: { ...shadow, offsetXEm } })
              }
            />
            <TransactionSlider
              label="Offset Y"
              value={shadow.offsetYEm}
              min={-0.5}
              max={0.5}
              step={0.01}
              format={percent}
              onChange={(offsetYEm) =>
                update({ shadow: { ...shadow, offsetYEm } })
              }
            />
          </>
        ) : null}
      </EffectToggle>

      <EffectToggle
        title="Highlight"
        enabled={highlight !== null}
        onToggle={(on) => update({ highlight: on ? DEFAULT_HIGHLIGHT : null })}
      >
        {highlight ? (
          <>
            <ColorPicker
              label="Highlight color"
              value={highlight.color}
              onChange={(color) =>
                update({ highlight: { ...highlight, color } })
              }
            />
            <TransactionSlider
              label="Padding"
              value={highlight.paddingEm}
              min={0}
              max={1}
              step={0.01}
              format={percent}
              onChange={(paddingEm) =>
                update({ highlight: { ...highlight, paddingEm } })
              }
            />
            <TransactionSlider
              label="Roundness"
              value={highlight.radiusEm}
              min={0}
              max={1}
              step={0.01}
              format={percent}
              onChange={(radiusEm) =>
                update({ highlight: { ...highlight, radiusEm } })
              }
            />
          </>
        ) : null}
      </EffectToggle>
    </>
  );
};
