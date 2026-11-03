"use client";

import type Konva from "konva";
import { useMemo, useRef } from "react";
import { Shape } from "react-konva";

import { useEditor } from "@/components/editor/editor-store-context";
import { PHOTO_EFFECTS_ATTR, usePhotoEffects } from "@/hooks/use-photo-effects";
import type {
  EffectBitmap,
  PhotoEffectBitmaps,
} from "@/hooks/use-photo-effects";
import type { PhotoElement } from "@/lib/document/schema";
import {
  LIVE_CROP_ATTR,
  PHOTO_EFFECTS_NAME,
  photoNodeOf,
} from "@/lib/editor/node-names";
import { photoClip } from "@/lib/photo-effects/mask";
import type { PhotoClip } from "@/lib/photo-effects/mask";

// Where the shadow goes, in page px; a node attr, so dragging its sliders
// costs no recompute
const SHADOW_OFFSET_ATTR = "effectShadowOffset";

// The shadow's offset in the element's own space: turned back by its
// rotation, so the shadow falls the same way on the page however the photo
// is turned, as Konva's own shadows do
const localOffset = (shape: Konva.Shape): { x: number; y: number } => {
  const offset = shape.getAttr(SHADOW_OFFSET_ATTR) as
    | { x: number; y: number }
    | undefined;
  if (!offset) {
    return { x: 0, y: 0 };
  }
  const radians = (shape.getAbsoluteRotation() * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: offset.x * cos + offset.y * sin,
    y: offset.y * cos - offset.x * sin,
  };
};

// Draws the bitmaps around the box they were made for, stretched to the
// box's current size (a resize shows them scaled until the recompute)
const drawPhotoEffects = (context: Konva.Context, shape: Konva.Shape) => {
  const bitmaps = shape.getAttr(PHOTO_EFFECTS_ATTR) as
    | PhotoEffectBitmaps
    | null
    | undefined;
  const element = shape.getParent();
  // A side handle is cropping the photo live; its effects come back baked
  if (!bitmaps || (element && photoNodeOf(element)?.getAttr(LIVE_CROP_ATTR))) {
    return;
  }
  const native = context._context;
  const scaleX = shape.width() / bitmaps.box.width;
  const scaleY = shape.height() / bitmaps.box.height;
  const place = ({ canvas, rect }: EffectBitmap, dx = 0, dy = 0) => {
    if (canvas.width === 0 || canvas.height === 0) {
      return;
    }
    native.drawImage(
      canvas,
      rect.x * scaleX + dx,
      rect.y * scaleY + dy,
      rect.width * scaleX,
      rect.height * scaleY
    );
  };
  if (bitmaps.shadow) {
    const offset = localOffset(shape);
    place(bitmaps.shadow, offset.x, offset.y);
  }
  if (bitmaps.halo) {
    place(bitmaps.halo);
  }
};

// A photo's outline, glow and shadow, drawn behind it from bitmaps made off
// screen. The shape is the size of the box, so handles, snapping and the
// click area stay on the box; it doesn't listen, and draws beyond itself.
export const PhotoEffectsNode = ({ element }: { element: PhotoElement }) => {
  const shapeRef = useRef<Konva.Shape>(null);
  const cropping = useEditor((state) => state.cropTargetId === element.id);
  const clipKey = JSON.stringify(photoClip(element));
  const clip = useMemo(() => JSON.parse(clipKey) as PhotoClip, [clipKey]);
  usePhotoEffects(shapeRef, element, clip, !cropping);
  const offsetX = element.shadow?.offsetX ?? 0;
  const offsetY = element.shadow?.offsetY ?? 0;
  const shadowOffset = useMemo(
    () => ({ x: offsetX, y: offsetY }),
    [offsetX, offsetY]
  );

  return (
    <Shape
      ref={shapeRef}
      name={PHOTO_EFFECTS_NAME}
      width={element.width}
      height={element.height}
      visible={!cropping}
      listening={false}
      perfectDrawEnabled={false}
      sceneFunc={drawPhotoEffects}
      // Read back as SHADOW_OFFSET_ATTR
      effectShadowOffset={shadowOffset}
    />
  );
};
