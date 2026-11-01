"use client";

import { RiCheckLine, RiCloseLine, RiCropLine } from "@remixicon/react";
import { useId } from "react";

import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cropZoom, zoomCrop } from "@/lib/document/crop";
import type { ImageElement } from "@/lib/document/schema";
import { updateElement } from "@/lib/editor/document-ops";

const MAX_ZOOM = 5;

// Floats over the canvas while an image is cropped
export const CropToolbar = ({ element }: { element: ImageElement }) => {
  const store = useEditorStoreApi();
  const zoomId = useId();
  const asset = useEditor((state) =>
    state.assets.find((item) => item.id === element.assetId)
  );

  const setZoom = (zoom: number) => {
    const crop = zoomCrop(element.crop, zoom);
    store.getState().change((doc) =>
      updateElement(doc, element.id, {
        crop: crop.width >= 1 && crop.height >= 1 ? null : crop,
      })
    );
  };

  // The whole photo again, at its own ratio and the current width
  const reset = () => {
    if (!asset) {
      return;
    }
    store.getState().change((doc) =>
      updateElement(doc, element.id, {
        crop: null,
        height: (element.width * asset.height) / asset.width,
      })
    );
  };

  return (
    <div className="bg-background absolute top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-full border px-3 py-1.5 shadow-md">
      <RiCropLine className="text-muted-foreground size-4" aria-hidden />
      <label htmlFor={zoomId} className="text-sm">
        Zoom
      </label>
      <Slider
        id={zoomId}
        aria-label="Zoom"
        className="w-32"
        value={[Math.min(MAX_ZOOM, cropZoom(element.crop))]}
        min={1}
        max={MAX_ZOOM}
        step={0.01}
        onValueChange={(next) =>
          setZoom(Array.isArray(next) ? (next[0] ?? 1) : next)
        }
      />
      <Button variant="ghost" size="sm" disabled={!asset} onClick={reset}>
        Reset
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => store.getState().finishCrop(false)}
      >
        <RiCloseLine data-icon="inline-start" />
        Cancel
      </Button>
      <Button size="sm" onClick={() => store.getState().finishCrop(true)}>
        <RiCheckLine data-icon="inline-start" />
        Done
      </Button>
    </div>
  );
};
