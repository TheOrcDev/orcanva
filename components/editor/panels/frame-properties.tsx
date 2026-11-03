"use client";

import {
  RiCropLine,
  RiDeleteBin2Line,
  RiFlipHorizontalLine,
  RiFlipVerticalLine,
  RiImageLine,
} from "@remixicon/react";

import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import { ImageAdjustments } from "@/components/editor/panels/image-adjustments";
import { ImageFilters } from "@/components/editor/panels/image-filters";
import { PanelSection } from "@/components/editor/panels/panel-section";
import { PhotoEffectsProperties } from "@/components/editor/panels/photo-effects-properties";
import { Button } from "@/components/ui/button";
import { useUpdateElement } from "@/hooks/use-selected-element";
import { FRAME_SHAPES } from "@/lib/document/frame-shapes";
import type { FrameElement } from "@/lib/document/schema";
import { detachPhoto } from "@/lib/editor/frames";

export const FrameProperties = ({ element }: { element: FrameElement }) => {
  const store = useEditorStoreApi();
  const update = useUpdateElement(element.id);
  const filled = element.assetId !== null;

  // The photo comes out as an image above the frame, which empties
  const detach = () => {
    let imageId: string | null = null;
    store.getState().change((doc) => {
      const result = detachPhoto(doc, element.id);
      ({ imageId } = result);
      return result.document;
    });
    if (imageId) {
      store.getState().select([imageId]);
    }
  };

  // The frame keeps its effects for the next photo
  const remove = () =>
    update({
      assetId: null,
      crop: null,
      filter: null,
      flipX: false,
      flipY: false,
    });

  return (
    <>
      <PanelSection title="Frame">
        <div className="grid grid-cols-5 gap-1">
          {FRAME_SHAPES.map((shape) => (
            <Button
              key={shape.id}
              variant="outline"
              size="icon"
              aria-label={`${shape.label} shape`}
              aria-pressed={element.shape === shape.id}
              disabled={element.locked}
              // Shapes share the frame's box, so the photo still covers it
              onClick={() => update({ shape: shape.id })}
            >
              <svg viewBox="0 0 1 1" className="size-4" aria-hidden>
                <path d={shape.path} className="fill-current" />
              </svg>
            </Button>
          ))}
        </div>
        {filled ? (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={element.locked}
              onClick={() => store.getState().startCrop(element.id)}
            >
              <RiCropLine data-icon="inline-start" />
              Crop
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={element.locked}
              onClick={detach}
            >
              <RiImageLine data-icon="inline-start" />
              Detach photo
            </Button>
            <Button
              variant="outline"
              size="sm"
              aria-pressed={element.flipX}
              onClick={() => update({ flipX: !element.flipX })}
            >
              <RiFlipHorizontalLine data-icon="inline-start" />
              Flip H
            </Button>
            <Button
              variant="outline"
              size="sm"
              aria-pressed={element.flipY}
              onClick={() => update({ flipY: !element.flipY })}
            >
              <RiFlipVerticalLine data-icon="inline-start" />
              Flip V
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="col-span-2"
              disabled={element.locked}
              onClick={remove}
            >
              <RiDeleteBin2Line data-icon="inline-start" />
              Remove photo
            </Button>
          </div>
        ) : null}
        <p className="text-muted-foreground text-xs">
          {filled
            ? "Drop another photo on the frame to replace this one."
            : "Drop a photo from Uploads or your computer onto the frame to fill it."}
        </p>
      </PanelSection>
      {filled ? (
        <>
          <ImageFilters element={element} />
          <ImageAdjustments element={element} />
          <PhotoEffectsProperties element={element} />
        </>
      ) : null}
    </>
  );
};
