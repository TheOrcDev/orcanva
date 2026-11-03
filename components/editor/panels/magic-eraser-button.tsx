"use client";

import { RiEraserLine } from "@remixicon/react";

import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { Button } from "@/components/ui/button";
import type { PhotoElement } from "@/lib/document/schema";

// Opens erase mode on the canvas, like Crop does: brush over something,
// Erase, and Done saves the result as one undo step
export const MagicEraserButton = ({ element }: { element: PhotoElement }) => {
  const store = useEditorStoreApi();
  const ready = useEditor((state) =>
    state.assets.some((asset) => asset.id === element.assetId)
  );
  const job = useEditor((state) => state.imageJobs[element.id] ?? null);
  const open = useEditor((state) => state.eraseTargetId === element.id);

  return (
    <Button
      variant="outline"
      className="w-full"
      aria-pressed={open}
      disabled={!ready || element.locked || (job !== null && !open)}
      onClick={() => store.getState().startErase(element.id)}
    >
      <RiEraserLine data-icon="inline-start" />
      Magic eraser
    </Button>
  );
};
