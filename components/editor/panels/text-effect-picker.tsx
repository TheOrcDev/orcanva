"use client";

import { useEffect, useRef } from "react";

import { ColorPicker } from "@/components/editor/panels/color-picker";
import { PanelSection } from "@/components/editor/panels/panel-section";
import { TransactionSlider } from "@/components/editor/panels/transaction-slider";
import { useUpdateElement } from "@/hooks/use-selected-element";
import type { TextEffect, TextElement } from "@/lib/document/schema";
import {
  FALLBACK_FAMILIES,
  cssFamily,
  getFont,
  nearestWeight,
} from "@/lib/fonts/catalog";
import { canvasFont, canvasMeasurer, paintTextLayout } from "@/lib/text/canvas";
import {
  TEXT_EFFECTS,
  defaultEffect,
  effectControls,
  paintWithEffect,
} from "@/lib/text/effects";
import { layoutText } from "@/lib/text/layout";

const PREVIEW_WIDTH = 64;
const PREVIEW_HEIGHT = 40;
const PREVIEW_SIZE = 26;
const PREVIEW_FILL = "#111111";

const percent = (value: number) => `${Math.round(value * 100)}%`;

// "Ag" in the text's font with an effect, drawn by the same renderer
const EffectPreview = ({
  effect,
  font,
}: {
  effect: TextEffect | null;
  font: string;
}) => {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const context = canvas?.getContext("2d");
    if (!(canvas && context)) {
      return;
    }
    const ratio = window.devicePixelRatio || 1;
    canvas.width = PREVIEW_WIDTH * ratio;
    canvas.height = PREVIEW_HEIGHT * ratio;
    context.scale(ratio, ratio);
    const style = { font, fontSize: PREVIEW_SIZE, letterSpacing: 0 };
    const layout = layoutText(
      [{ style, text: "Ag" }],
      { align: "center", lineHeight: 1, width: PREVIEW_WIDTH },
      canvasMeasurer
    );
    const top = (PREVIEW_HEIGHT - layout.height) / 2;
    paintWithEffect({
      context,
      draw: (paint, dx, dy) => {
        context.save();
        context.translate(dx, top + dy);
        paintTextLayout(context, layout, () => paint);
        context.restore();
      },
      effect,
      fontSize: PREVIEW_SIZE,
      paint: { fill: PREVIEW_FILL, stroke: null, strokeWidth: 0 },
    });
  }, [effect, font]);

  return (
    <canvas ref={ref} aria-hidden className="h-10 w-16 rounded-lg bg-white" />
  );
};

export const TextEffectPicker = ({ element }: { element: TextElement }) => {
  const update = useUpdateElement(element.id);
  const { effect } = element;
  const font = getFont(element.fontId);
  // Previews use the text's own font once it's loaded (the canvas loaded it)
  const previewFont = canvasFont({
    family: document.fonts.check(`16px ${cssFamily(font)}`)
      ? cssFamily(font)
      : FALLBACK_FAMILIES[font.category],
    fontSize: PREVIEW_SIZE,
    italic: false,
    weight: nearestWeight(font, element.weight),
  });
  const controls = effect ? effectControls(effect.kind) : null;
  const choices = [
    { effect: null, kind: "none", label: "None" },
    ...TEXT_EFFECTS.map((item) => ({
      // The current settings when it's the chosen one, defaults otherwise
      effect: effect?.kind === item.kind ? effect : defaultEffect(item.kind),
      kind: item.kind,
      label: item.label,
    })),
  ];

  return (
    <PanelSection title="Style">
      <div className="grid grid-cols-4 gap-2">
        {choices.map((choice) => {
          const chosen = (effect?.kind ?? "none") === choice.kind;
          return (
            <button
              key={choice.kind}
              type="button"
              aria-pressed={chosen}
              aria-label={`${choice.label} style`}
              className="ring-foreground/10 hover:ring-ring data-[chosen=true]:ring-primary flex flex-col items-center gap-1 rounded-xl p-1 text-xs ring-1 transition-shadow hover:ring-2 data-[chosen=true]:ring-2"
              data-chosen={chosen}
              onClick={() => update({ effect: choice.effect })}
            >
              <EffectPreview effect={choice.effect} font={previewFont} />
              {choice.label}
            </button>
          );
        })}
      </div>
      {effect && controls ? (
        <>
          {controls.color ? (
            <ColorPicker
              label="Effect color"
              value={effect.color}
              onChange={(color) => update({ effect: { ...effect, color } })}
            />
          ) : null}
          {controls.intensity ? (
            <TransactionSlider
              label="Intensity"
              value={effect.intensity}
              min={0}
              max={100}
              onChange={(intensity) =>
                update({ effect: { ...effect, intensity } })
              }
            />
          ) : null}
          {controls.offset ? (
            <>
              <TransactionSlider
                label="Offset"
                value={effect.offsetEm}
                min={0}
                max={0.3}
                step={0.005}
                format={percent}
                onChange={(offsetEm) =>
                  update({ effect: { ...effect, offsetEm } })
                }
              />
              <TransactionSlider
                label="Direction"
                value={effect.angle}
                min={0}
                max={360}
                format={(angle) => `${angle}°`}
                onChange={(angle) => update({ effect: { ...effect, angle } })}
              />
            </>
          ) : null}
        </>
      ) : null}
    </PanelSection>
  );
};
