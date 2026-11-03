"use client";

import { useEffect, useMemo, useRef } from "react";

import { useEditor } from "@/components/editor/editor-store-context";
import { ColorPicker } from "@/components/editor/panels/color-picker";
import { EffectToggle } from "@/components/editor/panels/effect-toggle";
import { PanelSection } from "@/components/editor/panels/panel-section";
import { TransactionSlider } from "@/components/editor/panels/transaction-slider";
import { useAssetImage } from "@/hooks/use-asset-image";
import { useUpdateElement } from "@/hooks/use-selected-element";
import type { ImageCrop, PhotoElement } from "@/lib/document/schema";
import { DEFAULT_EFFECTS, effectsAtSize } from "@/lib/photo-effects/geometry";
import { photoClip } from "@/lib/photo-effects/mask";
import type { PhotoClip } from "@/lib/photo-effects/mask";
import {
  PHOTO_EFFECT_PRESETS,
  matchingPreset,
  presetEffects,
} from "@/lib/photo-effects/presets";
import type { PhotoEffectPreset } from "@/lib/photo-effects/presets";
import {
  EFFECT_PREVIEW_SIZE,
  drawEffectsPreview,
} from "@/lib/photo-effects/preview";
import type { PreviewPhoto } from "@/lib/photo-effects/preview";

const px = (value: number) => `${Math.round(value)}px`;

// Sliders reach a share of the photo's shorter side, and always as far as
// the current value (a photo scaled down keeps its thick outline)
const sliderMax = (side: number, share: number, value: number) =>
  Math.max(10, Math.round(side * share), Math.ceil(Math.abs(value)));

const PresetTile = ({
  photo,
  preset,
  pressed,
  onPick,
}: {
  photo: PreviewPhoto | null;
  preset: PhotoEffectPreset;
  pressed: boolean;
  onPick: () => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && photo) {
      drawEffectsPreview(canvas, photo, preset.effects);
    }
  }, [photo, preset]);

  return (
    <button
      type="button"
      aria-pressed={pressed}
      className="group flex min-w-0 flex-col gap-1 rounded-md text-xs"
      onClick={onPick}
    >
      <canvas
        ref={canvasRef}
        aria-hidden
        width={EFFECT_PREVIEW_SIZE}
        height={EFFECT_PREVIEW_SIZE}
        className="bg-muted ring-foreground/15 group-hover:ring-ring group-aria-pressed:ring-ring aspect-square w-full rounded-md ring-1 transition-shadow group-hover:ring-2 group-aria-pressed:ring-2"
      />
      <span className="text-muted-foreground group-aria-pressed:text-foreground truncate">
        {preset.name}
      </span>
    </button>
  );
};

// The photo as the page shows it (crop, flips, shape), for the tiles. It
// changes only when those do, so editing effects doesn't redraw them.
const usePreviewPhoto = (element: PhotoElement): PreviewPhoto | null => {
  const { assetId, crop, flipX, flipY } = element;
  const url = useEditor((state) =>
    assetId
      ? state.assets.find((asset) => asset.id === assetId)?.url
      : undefined
  );
  const { image } = useAssetImage(url);
  const ratio = Math.round((element.height / element.width) * 1000) / 1000;
  const shapeKey = JSON.stringify({ clip: photoClip(element), crop });
  return useMemo(() => {
    if (!image) {
      return null;
    }
    const shape = JSON.parse(shapeKey) as {
      clip: PhotoClip;
      crop: ImageCrop | null;
    };
    return {
      aspect: { height: ratio, width: 1 },
      clip: shape.clip,
      crop: shape.crop,
      flipX,
      flipY,
      source: image,
    };
  }, [image, ratio, shapeKey, flipX, flipY]);
};

// One-tap looks previewed on this photo, sized for it
const EffectPresets = ({ element }: { element: PhotoElement }) => {
  const update = useUpdateElement(element.id);
  const photo = usePreviewPhoto(element);
  const chosen = matchingPreset(element, element);

  return (
    <PanelSection title="Effects">
      <div className="grid grid-cols-3 gap-2">
        {PHOTO_EFFECT_PRESETS.map((preset) => (
          <PresetTile
            key={preset.id}
            photo={photo}
            preset={preset}
            pressed={chosen?.id === preset.id}
            onPick={() => update(presetEffects(preset, element))}
          />
        ))}
      </div>
    </PanelSection>
  );
};

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
      <EffectPresets element={element} />
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
