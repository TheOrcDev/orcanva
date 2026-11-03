"use client";

import {
  RiFlipHorizontalLine,
  RiFlipVerticalLine,
  RiResetLeftLine,
} from "@remixicon/react";
import { useState } from "react";

import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import { ColorPicker } from "@/components/editor/panels/color-picker";
import { EffectToggle } from "@/components/editor/panels/effect-toggle";
import { PanelSection } from "@/components/editor/panels/panel-section";
import { TransactionSlider } from "@/components/editor/panels/transaction-slider";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { useUpdateElement } from "@/hooks/use-selected-element";
import { MAX_STROKE_SCALE, MIN_STROKE_SCALE } from "@/lib/document/schema";
import type { GraphicElement } from "@/lib/document/schema";
import { findElement, updateElement } from "@/lib/editor/document-ops";
import {
  DEFAULT_GRAPHIC_OUTLINE,
  clampStrokeScale,
  hasStrokes,
  maxOutlinePx,
  outlineAtPx,
  outlinePx,
  paletteSwatches,
  resetColorsPatch,
  withPaletteColor,
} from "@/lib/editor/graphic-ops";
import { findGraphic } from "@/lib/graphics/catalog";

const percent = (value: number) => `${Math.round(value)}%`;
const px = (value: number) => `${Math.round(value)}px`;

// One swatch per colour the art paints with; changing one recolours every
// part that shares it. Each popover session is one undo step.
const ColorSwatches = ({ element }: { element: GraphicElement }) => {
  const update = useUpdateElement(element.id);
  const swatches = paletteSwatches(element);

  if (swatches.length === 1) {
    const [only] = swatches;
    return only ? (
      <ColorPicker
        label="Color"
        value={only.color}
        onChange={(color) =>
          update(withPaletteColor(element, only.index, color))
        }
      />
    ) : null;
  }
  return (
    <ul className="grid grid-cols-6 gap-2" aria-label="Colors">
      {swatches.map(({ color, index }, position) => (
        <li key={index} className="flex">
          <ColorPicker
            label={`Color ${position + 1}`}
            value={color}
            trigger="swatch"
            onChange={(next) => update(withPaletteColor(element, index, next))}
          />
        </li>
      ))}
    </ul>
  );
};

// Back to the art's own palette, looked up from where it came from
const ResetColors = ({ element }: { element: GraphicElement }) => {
  const store = useEditorStoreApi();
  const [busy, setBusy] = useState(false);
  const { id, source } = element;

  const reset = async () => {
    if (!source) {
      return;
    }
    setBusy(true);
    let original: Awaited<ReturnType<typeof findGraphic>> = null;
    try {
      original = await findGraphic(source);
    } catch {
      setBusy(false);
      toast.add({ title: "Couldn’t load the original colors", type: "error" });
      return;
    }
    setBusy(false);
    if (!original) {
      toast.add({
        title: "This graphic’s own colors aren’t available anymore",
        type: "error",
      });
      return;
    }
    const { palette } = original;
    store.getState().change((doc) => {
      // The element as it is now, in case it changed while this loaded
      const current = findElement(doc, id);
      const patch =
        current?.type === "graphic"
          ? resetColorsPatch(current, { palette })
          : null;
      return patch ? updateElement(doc, id, patch) : doc;
    });
  };

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={!source || busy}
      onClick={() => {
        reset().catch(() => null);
      }}
    >
      <RiResetLeftLine data-icon="inline-start" />
      Reset colors
    </Button>
  );
};

const Outline = ({ element }: { element: GraphicElement }) => {
  const update = useUpdateElement(element.id);
  const { outline } = element;
  const max = Math.max(1, Math.round(maxOutlinePx(element)));

  return (
    <EffectToggle
      title="Outline"
      enabled={outline !== null}
      onToggle={(enabled) =>
        update({ outline: enabled ? DEFAULT_GRAPHIC_OUTLINE : null })
      }
    >
      {outline ? (
        <>
          <ColorPicker
            label="Outline color"
            value={outline.color}
            onChange={(color) => update({ outline: { ...outline, color } })}
          />
          <TransactionSlider
            label="Thickness"
            value={Math.min(max, Math.round(outlinePx(element)))}
            min={0}
            max={max}
            format={px}
            onChange={(value) =>
              update({ outline: outlineAtPx(element, value) })
            }
          />
        </>
      ) : null}
    </EffectToggle>
  );
};

export const GraphicProperties = ({ element }: { element: GraphicElement }) => {
  const update = useUpdateElement(element.id);

  return (
    <>
      <PanelSection title="Colors">
        <ColorSwatches element={element} />
        <ResetColors element={element} />
      </PanelSection>
      {hasStrokes(element) ? (
        <PanelSection title="Lines">
          <TransactionSlider
            label="Line weight"
            value={Math.round(element.strokeScale * 100)}
            min={MIN_STROKE_SCALE * 100}
            max={MAX_STROKE_SCALE * 100}
            step={5}
            format={percent}
            onChange={(value) =>
              update({ strokeScale: clampStrokeScale(value / 100) })
            }
          />
        </PanelSection>
      ) : null}
      <Outline element={element} />
      <PanelSection title="Flip">
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
    </>
  );
};
