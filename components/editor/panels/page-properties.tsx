"use client";

import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { ColorPicker } from "@/components/editor/panels/color-picker";
import { PanelSection } from "@/components/editor/panels/panel-section";
import { DEFAULT_BACKGROUND_COLOR } from "@/lib/document/factories";
import { setBackground } from "@/lib/editor/document-ops";
import { selectDocument } from "@/lib/editor/store";
import { formatSize } from "@/lib/format";

export const PageProperties = () => {
  const store = useEditorStoreApi();
  const document = useEditor(selectDocument);
  const { background } = document;

  const solidColor =
    background.type === "solid"
      ? background.color
      : (background.stops[0]?.color ?? DEFAULT_BACKGROUND_COLOR);

  return (
    <>
      <PanelSection title="Canvas">
        <p className="text-sm tabular-nums">
          {formatSize(document.width, document.height)} px
        </p>
      </PanelSection>
      <PanelSection title="Background">
        <ColorPicker
          label="Background color"
          value={solidColor}
          onChange={(color) =>
            store
              .getState()
              .change((doc) => setBackground(doc, { color, type: "solid" }))
          }
        />
      </PanelSection>
    </>
  );
};
