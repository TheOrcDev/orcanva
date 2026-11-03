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
  Math.max(10, Math.round(side * share), Math.ceil(Math.abs(value)));

// Outline, glow and shadow for an image or a frame's photo, in page px.
// Each slider scrub and colour-picker session is one undo step.
export const PhotoEffectsProperties = ({
  element,
}: {
  element: PhotoElement;
}) => {
  const update = useUpdateElement(element.id);
  const { glow, outline, shadow } = element;
  const side = Math.min(element.width, element.height);
  const defaults = effectsAtSize(DEFAULT_EFFECTS, element);
  const offsetMax = sliderMax(
    side,
    0.25,
    Math.max(Math.abs(shadow?.offsetX ?? 0), Math.abs(shadow?.offsetY ?? 0))
  );

  return (
    <>
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

      <EffectToggle
        title="Glow"
        enabled={glow !== null}
        onToggle={(on) => update({ glow: on ? defaults.glow : null })}
      >
        {glow ? (
          <>
            <ColorPicker
              label="Glow color"
              value={glow.color}
              onChange={(color) => update({ glow: { ...glow, color } })}
            />
            <TransactionSlider
              label="Size"
              value={glow.size}
              min={0}
              max={sliderMax(side, 0.4, glow.size)}
              format={px}
              onChange={(size) => update({ glow: { ...glow, size } })}
            />
          </>
        ) : null}
      </EffectToggle>

      <EffectToggle
        title="Drop shadow"
        enabled={shadow !== null}
        onToggle={(on) => update({ shadow: on ? defaults.shadow : null })}
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
              value={shadow.blur}
              min={0}
              max={sliderMax(side, 0.3, shadow.blur)}
              format={px}
              onChange={(blur) => update({ shadow: { ...shadow, blur } })}
            />
            <TransactionSlider
              label="Offset X"
              value={shadow.offsetX}
              min={-offsetMax}
              max={offsetMax}
              format={px}
              onChange={(offsetX) => update({ shadow: { ...shadow, offsetX } })}
            />
            <TransactionSlider
              label="Offset Y"
              value={shadow.offsetY}
              min={-offsetMax}
              max={offsetMax}
              format={px}
              onChange={(offsetY) => update({ shadow: { ...shadow, offsetY } })}
            />
          </>
        ) : null}
      </EffectToggle>
    </>
  );
};
