"use client";

import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { ColorPicker } from "@/components/editor/panels/color-picker";
import { PanelSection } from "@/components/editor/panels/panel-section";
import { TransactionSlider } from "@/components/editor/panels/transaction-slider";
import { ResizeCanvasDialog } from "@/components/editor/resize-canvas-dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DEFAULT_BACKGROUND_COLOR } from "@/lib/document/factories";
import type { Background, GradientStop } from "@/lib/document/schema";
import { setBackground } from "@/lib/editor/document-ops";
import { selectDocument } from "@/lib/editor/store";
import { formatSize } from "@/lib/format";

type LinearBackground = Extract<Background, { type: "linear" }>;

const GRADIENT_PRESETS: { name: string; from: string; to: string }[] = [
  { from: "#ff512f", name: "Sunset", to: "#dd2476" },
  { from: "#00c6ff", name: "Ocean", to: "#0072ff" },
  { from: "#f7971e", name: "Gold", to: "#ffd200" },
  { from: "#8e2de2", name: "Violet", to: "#4a00e0" },
  { from: "#11998e", name: "Emerald", to: "#38ef7d" },
  { from: "#141e30", name: "Midnight", to: "#243b55" },
];

const DEFAULT_ANGLE = 135;

const gradient = (
  from: string,
  to: string,
  angle: number
): LinearBackground => ({
  angle,
  stops: [
    { color: from, offset: 0 },
    { color: to, offset: 1 },
  ],
  type: "linear",
});

const firstColor = (background: Background) =>
  background.type === "solid"
    ? background.color
    : (background.stops[0]?.color ?? DEFAULT_BACKGROUND_COLOR);

const withStop = (
  background: LinearBackground,
  index: number,
  color: string
): LinearBackground => ({
  ...background,
  stops: background.stops.map((stop: GradientStop, stopIndex) =>
    stopIndex === index ? { ...stop, color } : stop
  ),
});

export const PageProperties = () => {
  const store = useEditorStoreApi();
  const document = useEditor(selectDocument);
  const { background } = document;

  const apply = (next: Background) =>
    store.getState().change((doc) => setBackground(doc, next));

  const switchType = (type: unknown) => {
    if (type === background.type) {
      return;
    }
    if (type === "solid") {
      apply({ color: firstColor(background), type: "solid" });
    }
    if (type === "linear") {
      const [preset] = GRADIENT_PRESETS;
      apply(
        gradient(
          preset?.from ?? "#ffffff",
          preset?.to ?? "#000000",
          DEFAULT_ANGLE
        )
      );
    }
  };

  return (
    <>
      <PanelSection title="Canvas" action={<ResizeCanvasDialog />}>
        <p className="text-sm tabular-nums">
          {formatSize(document.width, document.height)} px
        </p>
      </PanelSection>
      <PanelSection title="Background">
        <ToggleGroup
          variant="outline"
          size="sm"
          value={[background.type]}
          onValueChange={(value) => switchType(value[0])}
        >
          <ToggleGroupItem value="solid">Solid</ToggleGroupItem>
          <ToggleGroupItem value="linear">Gradient</ToggleGroupItem>
        </ToggleGroup>

        {background.type === "solid" ? (
          <ColorPicker
            label="Background color"
            value={background.color}
            onChange={(color) => apply({ color, type: "solid" })}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              <ColorPicker
                label="Gradient start"
                value={background.stops[0]?.color ?? "#ffffff"}
                onChange={(color) => apply(withStop(background, 0, color))}
              />
              <ColorPicker
                label="Gradient end"
                value={background.stops.at(-1)?.color ?? "#000000"}
                onChange={(color) =>
                  apply(
                    withStop(background, background.stops.length - 1, color)
                  )
                }
              />
            </div>
            <TransactionSlider
              label="Angle"
              value={background.angle}
              min={0}
              max={360}
              format={(value) => `${value}°`}
              onChange={(angle) => apply({ ...background, angle })}
            />
            <div className="grid grid-cols-6 gap-2">
              {GRADIENT_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  aria-label={`${preset.name} gradient`}
                  title={preset.name}
                  className="ring-foreground/15 hover:ring-ring aspect-square rounded-full bg-linear-to-br from-(--from) to-(--to) ring-1 transition-shadow hover:ring-2"
                  style={{ "--from": preset.from, "--to": preset.to }}
                  onClick={() =>
                    apply(gradient(preset.from, preset.to, background.angle))
                  }
                />
              ))}
            </div>
          </>
        )}
      </PanelSection>
    </>
  );
};
