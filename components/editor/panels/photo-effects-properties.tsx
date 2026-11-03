"use client";

import { ColorPicker } from "@/components/editor/panels/color-picker";
import { EffectToggle } from "@/components/editor/panels/effect-toggle";
import { TransactionSlider } from "@/components/editor/panels/transaction-slider";
import { useUpdateElement } from "@/hooks/use-selected-element";
import type { PhotoElement } from "@/lib/document/schema";
import { DEFAULT_EFFECTS, effectsAtSize } from "@/lib/photo-effects/geometry";

const px = (value: number) => `${Math.round(value)}px`;

// Sliders reach a share of the photo's shorter side, and always as far as
// the current value (a photo scaled down keeps its thick outline)
const sliderMax = (side: number, share: number, value: number) =>
  Math.max(10, Math.round(side * share), Math.ceil(value));

// Outline, glow and shadow for an image or a frame's photo, in page px
export const PhotoEffectsProperties = ({
  element,
}: {
  element: PhotoElement;
}) => {
  const update = useUpdateElement(element.id);
  const { outline } = element;
  const side = Math.min(element.width, element.height);
  const defaults = effectsAtSize(DEFAULT_EFFECTS, element);

  return (
    <EffectToggle
      title="Outline"
      enabled={outline !== null}
      onToggle={(on) => update({ outline: on ? defaults.outline : null })}
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
            value={outline.width}
            min={0}
            max={sliderMax(side, 0.15, outline.width)}
            format={px}
            onChange={(width) => update({ outline: { ...outline, width } })}
          />
        </>
      ) : null}
    </EffectToggle>
  );
};
