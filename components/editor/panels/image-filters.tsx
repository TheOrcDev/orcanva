"use client";

import { useEffect, useRef } from "react";

import { useEditor } from "@/components/editor/editor-store-context";
import { PanelSection } from "@/components/editor/panels/panel-section";
import { TransactionSlider } from "@/components/editor/panels/transaction-slider";
import { useAssetImage } from "@/hooks/use-asset-image";
import { useUpdateElement } from "@/hooks/use-selected-element";
import type { ImageElement } from "@/lib/document/schema";
import { withPreset, withStrength } from "@/lib/image-filters/edit";
import { FILTER_PRESETS, findPreset } from "@/lib/image-filters/presets";
import {
  PRESET_PREVIEW_SIZE,
  drawPresetPreview,
} from "@/lib/image-filters/preview";

const PresetTile = ({
  image,
  preset,
  name,
  pressed,
  onPick,
}: {
  image: HTMLImageElement | undefined;
  preset: string | null;
  name: string;
  pressed: boolean;
  onPick: () => void;
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas && image) {
      drawPresetPreview(image, preset, canvas);
    }
  }, [image, preset]);

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
        width={PRESET_PREVIEW_SIZE}
        height={PRESET_PREVIEW_SIZE}
        className="bg-muted ring-foreground/15 group-hover:ring-ring group-aria-pressed:ring-ring aspect-square w-full rounded-md ring-1 transition-shadow group-hover:ring-2 group-aria-pressed:ring-2"
      />
      <span className="text-muted-foreground group-aria-pressed:text-foreground truncate">
        {name}
      </span>
    </button>
  );
};

// One-tap looks previewed on this photo, plus how strongly to apply them
export const ImageFilters = ({ element }: { element: ImageElement }) => {
  const update = useUpdateElement(element.id);
  const url = useEditor(
    (state) => state.assets.find((asset) => asset.id === element.assetId)?.url
  );
  const { image } = useAssetImage(url);
  const { filter } = element;
  const active = findPreset(filter?.preset ?? null);

  return (
    <PanelSection title="Filters">
      <div className="grid grid-cols-3 gap-2">
        <PresetTile
          image={image}
          preset={null}
          name="Original"
          pressed={!active}
          onPick={() => update({ filter: withPreset(filter, null) })}
        />
        {FILTER_PRESETS.map((preset) => (
          <PresetTile
            key={preset.id}
            image={image}
            preset={preset.id}
            name={preset.name}
            pressed={active?.id === preset.id}
            onPick={() => update({ filter: withPreset(filter, preset.id) })}
          />
        ))}
      </div>
      {active && filter ? (
        <TransactionSlider
          label="Intensity"
          value={filter.strength}
          min={0}
          max={100}
          format={(value) => `${value}%`}
          onChange={(strength) =>
            update({ filter: withStrength(filter, strength) })
          }
        />
      ) : null}
    </PanelSection>
  );
};
