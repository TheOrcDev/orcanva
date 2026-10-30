"use client";

import { PanelSection } from "@/components/editor/panels/panel-section";
import { Button } from "@/components/ui/button";
import { useFontReady } from "@/hooks/use-font-ready";
import { useInsertElement } from "@/hooks/use-insert-element";
import { TEXT_PRESETS, createTextElement } from "@/lib/document/factories";
import type { TextPreset } from "@/lib/document/factories";
import { cssFamily, getFont } from "@/lib/fonts/catalog";
import { cn } from "@/lib/utils";

const BASIC: TextPreset[] = ["heading", "subheading", "body"];
const THUMBNAIL_STYLES: TextPreset[] = ["outlined", "label", "shadow"];

const PREVIEW_SIZES: Record<TextPreset, string> = {
  body: "text-sm",
  heading: "text-2xl",
  label: "text-base",
  outlined: "text-2xl",
  shadow: "text-2xl",
  subheading: "text-lg",
};

const PresetButton = ({ preset }: { preset: TextPreset }) => {
  const insert = useInsertElement();
  const config = TEXT_PRESETS[preset];
  const font = getFont(config.fontId);
  // Loading the real font here means it's ready when the text lands
  const ready = useFontReady({
    fontId: font.id,
    italic: false,
    text: config.text,
    weight: config.weight,
  });

  return (
    <Button
      variant="outline"
      className="h-16 w-full justify-start"
      onClick={() => insert((page) => createTextElement(preset, page))}
    >
      <span
        className={cn(
          "truncate font-(family-name:--preset-font)",
          PREVIEW_SIZES[preset],
          config.uppercase && "uppercase"
        )}
        style={{ "--preset-font": ready ? cssFamily(font) : "inherit" }}
      >
        {config.text}
      </span>
    </Button>
  );
};

export const TextPanel = () => (
  <>
    <PanelSection title="Text">
      <div className="flex flex-col gap-2">
        {BASIC.map((preset) => (
          <PresetButton key={preset} preset={preset} />
        ))}
      </div>
    </PanelSection>
    <PanelSection title="Thumbnail styles">
      <div className="flex flex-col gap-2">
        {THUMBNAIL_STYLES.map((preset) => (
          <PresetButton key={preset} preset={preset} />
        ))}
      </div>
      <p className="text-muted-foreground text-xs">
        Double-click text on the canvas, or press Enter, to edit it.
      </p>
    </PanelSection>
  </>
);
