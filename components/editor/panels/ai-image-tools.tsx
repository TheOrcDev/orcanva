"use client";

import { RiArrowGoBackLine } from "@remixicon/react";

import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { BackgroundRemovalButton } from "@/components/editor/panels/background-removal-button";
import { PanelSection } from "@/components/editor/panels/panel-section";
import { UpscaleButtons } from "@/components/editor/panels/upscale-button";
import { Button } from "@/components/ui/button";
import type { ImageElement } from "@/lib/document/schema";
import { originalAssetId } from "@/lib/editor/asset-variants";
import { updateElement } from "@/lib/editor/document-ops";

// Switches back to the upload every cutout, erase and upscale of this photo
// was made from, in one step however many there were
const RestoreOriginalButton = ({ element }: { element: ImageElement }) => {
  const store = useEditorStoreApi();
  const original = useEditor((state) =>
    originalAssetId(state.assets, element.assetId)
  );
  if (original === element.assetId) {
    return null;
  }
  return (
    <Button
      variant="outline"
      className="w-full"
      disabled={element.locked}
      onClick={() =>
        store
          .getState()
          .change((doc) =>
            updateElement(doc, element.id, { assetId: original })
          )
      }
    >
      <RiArrowGoBackLine data-icon="inline-start" />
      Restore original
    </Button>
  );
};

// The models that change a photo's pixels, all running in the browser. Each
// result is a new asset linked to the one it came from (lib/assets/variants).
export const AiImageTools = ({ element }: { element: ImageElement }) => (
  <PanelSection title="AI tools">
    <BackgroundRemovalButton element={element} />
    <UpscaleButtons element={element} />
    <RestoreOriginalButton element={element} />
  </PanelSection>
);
