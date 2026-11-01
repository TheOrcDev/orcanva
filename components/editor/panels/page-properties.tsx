"use client";

import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { ColorPicker } from "@/components/editor/panels/color-picker";
import {
  GRADIENT_PRESETS,
  GradientFields,
  twoColorGradient,
} from "@/components/editor/panels/gradient-fields";
import { PanelSection } from "@/components/editor/panels/panel-section";
import { ResizeCanvasDialog } from "@/components/editor/resize-canvas-dialog";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { DEFAULT_BACKGROUND_COLOR } from "@/lib/document/factories";
import type { Background } from "@/lib/document/schema";
import { setBackground } from "@/lib/editor/document-ops";
import { selectDocument } from "@/lib/editor/store";
import { formatSize } from "@/lib/format";

const DEFAULT_ANGLE = 135;

const firstColor = (background: Background) =>
  background.type === "solid"
    ? background.color
    : (background.stops[0]?.color ?? DEFAULT_BACKGROUND_COLOR);

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
      apply({
        ...twoColorGradient(
          preset?.from ?? "#ffffff",
          preset?.to ?? "#000000",
          DEFAULT_ANGLE
        ),
        type: "linear",
      });
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
          <GradientFields value={background} onChange={apply} />
        )}
      </PanelSection>
    </>
  );
};
