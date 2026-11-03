"use client";

import { RiArrowGoBackLine } from "@remixicon/react";

import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { BackgroundRemovalButton } from "@/components/editor/panels/background-removal-button";
import { MagicEraserButton } from "@/components/editor/panels/magic-eraser-button";
import { PanelSection } from "@/components/editor/panels/panel-section";
import { UpscaleButtons } from "@/components/editor/panels/upscale-button";
import { Button } from "@/components/ui/button";
import type { PhotoElement } from "@/lib/document/schema";
import { originalAssetId } from "@/lib/editor/asset-variants";
import { updateElement } from "@/lib/editor/document-ops";

// Switches back to the upload every cutout, erase and upscale of this photo
// was made from, in one step however many there were
const RestoreOriginalButton = ({
  assetId,
  element,
}: {
  assetId: string;
  element: PhotoElement;
}) => {
  const store = useEditorStoreApi();
  const original = useEditor((state) => originalAssetId(state.assets, assetId));
  if (original === assetId) {
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

// The models that change a photo's pixels, all running in the browser, for
// an image or a filled frame. Each result is a new asset linked to the one it
// came from (lib/assets/variants).
export const AiImageTools = ({ element }: { element: PhotoElement }) => {
  const { assetId } = element;
  if (!assetId) {
    return null;
  }
  return (
    <PanelSection title="AI tools">
      <BackgroundRemovalButton assetId={assetId} element={element} />
      <MagicEraserButton element={element} />
      <UpscaleButtons assetId={assetId} element={element} />
      <RestoreOriginalButton assetId={assetId} element={element} />
    </PanelSection>
  );
};
