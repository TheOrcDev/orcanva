"use client";

import type Konva from "konva";
import { useEffect, useEffectEvent, useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";

import { useEditor } from "@/components/editor/editor-store-context";
import { toast } from "@/components/ui/toast";
import { useAssetImage } from "@/hooks/use-asset-image";
import type { Rect, Size } from "@/lib/document/geometry";
import type { PhotoEffects, PhotoElement } from "@/lib/document/schema";
import { photoNodeOf } from "@/lib/editor/node-names";
import { maxFilterSide } from "@/lib/image-filters/renderer";
import { resolveFilter, toUniforms } from "@/lib/image-filters/resolve";
import { effectRgba } from "@/lib/photo-effects/color";
import {
  effectsLayout,
  effectsPaint,
  regionOnPage,
} from "@/lib/photo-effects/geometry";
import type { PhotoClip } from "@/lib/photo-effects/mask";
import {
  forgetPhotoEffects,
  renderPhotoEffects,
} from "@/lib/photo-effects/renderer";
import { photoEffectsScheduler } from "@/lib/photo-effects/scheduler";

// The bitmaps an effects node draws, kept on the node so the export clone
// shares them
export const PHOTO_EFFECTS_ATTR = "photoEffects";

export interface EffectBitmap {
  canvas: HTMLCanvasElement;
  // Where it goes, in page px from the box's top-left corner
  rect: Rect;
}

export interface PhotoEffectBitmaps {
  // The box they were drawn for; a resized box stretches them until the
  // recompute lands
  box: Size;
  // Outline and glow
  halo: EffectBitmap | null;
  // Drawn at the shadow's offset, which the node applies (see
  // PhotoEffectsNode), so moving it costs no recompute
  shadow: EffectBitmap | null;
}

// Canvases a photo's bitmaps are drawn into, reused from one recompute to
// the next. The object also stands for the photo in the renderer's cache.
interface Canvases {
  halo: HTMLCanvasElement | null;
  shadow: HTMLCanvasElement | null;
}

let warnedUnsupported = false;

const warnUnsupported = () => {
  if (warnedUnsupported) {
    return;
  }
  warnedUnsupported = true;
  toast.add({
    description: "This browser has no WebGL2, so photos show without them.",
    title: "Photo effects can't be shown",
    type: "error",
  });
};

const releaseCanvas = (canvas: HTMLCanvasElement | null) => {
  if (canvas) {
    canvas.width = 0;
    canvas.height = 0;
  }
};

const clearBitmaps = (shape: Konva.Shape | null, canvases: Canvases) => {
  if (shape?.getAttr(PHOTO_EFFECTS_ATTR)) {
    shape.setAttr(PHOTO_EFFECTS_ATTR, null);
    shape.getLayer()?.batchDraw();
  }
  forgetPhotoEffects(canvases);
  releaseCanvas(canvases.halo);
  releaseCanvas(canvases.shadow);
};

const showsEffects = ({ glow, outline, shadow }: PhotoEffects): boolean =>
  (outline !== null && outline.width > 0) ||
  (glow !== null && glow.size > 0) ||
  shadow !== null;

// Keeps an effects node's bitmaps in step with its photo. Work waits for the
// next frame, so a scrub recomputes at most once per frame, and moving or
// resizing the element recomputes nothing until it's baked. `active` is
// false while the photo is being cropped.
export const usePhotoEffects = (
  shapeRef: RefObject<Konva.Shape | null>,
  element: PhotoElement,
  clip: PhotoClip,
  active: boolean
) => {
  const { assetId, crop, filter, flipX, flipY, height, width } = element;
  const url = useEditor((state) =>
    assetId ? state.assets.find((asset) => asset.id === assetId)?.url : null
  );
  const missing = useEditor(
    (state) => assetId !== null && state.missingAssetIds.includes(assetId)
  );
  const { image, status } = useAssetImage(url ?? undefined);
  const canvasesRef = useRef<Canvases>({ halo: null, shadow: null });

  const effects: PhotoEffects = {
    glow: element.glow,
    outline: element.outline,
    shadow: element.shadow,
  };
  // What the bitmaps are coloured from. The shadow's offset isn't: the node
  // places the shadow.
  const { shadow } = element;
  const paintKey = JSON.stringify({
    effects: {
      ...effects,
      shadow: shadow && { ...shadow, offsetX: 0, offsetY: 0 },
    },
    opacity: element.opacity,
  });
  // What the field follows: the photo's pixels (a filter's blur softens
  // their edge), how they're cropped, flipped and clipped, and the box
  const blur = resolveFilter(filter);
  const shapeKey = JSON.stringify({
    blur: blur ? toUniforms(blur).blur : 0,
    clip,
    crop,
    flipX,
    flipY,
    height,
    url,
    width,
  });
  const visible = active && showsEffects(effects) && url !== null;

  const draw = useEffectEvent(
    (shape: Konva.Shape, paintJson: string, fieldShape: string): boolean => {
      const canvases = canvasesRef.current;
      const group = shape.getParent();
      const source = group ? photoNodeOf(group)?.image() : undefined;
      if (
        !(
          source instanceof HTMLImageElement ||
          source instanceof HTMLCanvasElement
        )
      ) {
        return false;
      }
      const box = { height, width };
      const settings = JSON.parse(paintJson) as {
        effects: PhotoEffects;
        opacity: number;
      };
      const layout = effectsLayout(box, settings.effects, maxFilterSide());
      if (!layout) {
        clearBitmaps(shape, canvases);
        return true;
      }
      const halo = canvases.halo ?? document.createElement("canvas");
      const shadowCanvas = canvases.shadow ?? document.createElement("canvas");
      canvases.halo = halo;
      canvases.shadow = shadowCanvas;
      const paint = effectsPaint(
        settings.effects,
        settings.opacity,
        layout.scale,
        effectRgba
      );
      const output = renderPhotoEffects({
        fieldKey: JSON.stringify([
          fieldShape,
          paint.outline?.width ?? 0,
          layout.pad,
          layout.scale,
        ]),
        halo,
        layout,
        mask: { box, clip, crop, flipX, flipY, source },
        owner: canvases,
        paint,
        shadow: shadowCanvas,
      });
      if (!output) {
        warnUnsupported();
        clearBitmaps(shape, canvases);
        return true;
      }
      const bitmap = (
        drawn: boolean,
        canvas: HTMLCanvasElement,
        region: Rect | null
      ): EffectBitmap | null => {
        if (drawn && region) {
          return { canvas, rect: regionOnPage(layout, region) };
        }
        releaseCanvas(canvas);
        return null;
      };
      const bitmaps: PhotoEffectBitmaps = {
        box,
        halo: bitmap(output.halo, halo, layout.halo),
        shadow: bitmap(output.shadow, shadowCanvas, layout.shadow),
      };
      shape.setAttr(PHOTO_EFFECTS_ATTR, bitmaps);
      shape.getLayer()?.batchDraw();
      return true;
    }
  );

  useLayoutEffect(() => {
    const shape = shapeRef.current;
    const canvases = canvasesRef.current;
    if (!(shape && visible) || status === "error" || missing) {
      photoEffectsScheduler.release(canvases);
      clearBitmaps(shape, canvases);
      return;
    }
    if (!image) {
      // Exports wait for it to load
      photoEffectsScheduler.hold(canvases);
      return;
    }
    photoEffectsScheduler.request(canvases, () =>
      draw(shape, paintKey, shapeKey)
    );
  }, [image, missing, paintKey, shapeKey, shapeRef, status, visible]);

  useEffect(() => {
    const canvases = canvasesRef.current;
    return () => {
      photoEffectsScheduler.release(canvases);
      clearBitmaps(null, canvases);
    };
  }, []);
};
