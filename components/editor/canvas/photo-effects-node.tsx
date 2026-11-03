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
import { frameShape } from "@/lib/document/frame-shapes";
import type { PhotoElement } from "@/lib/document/schema";
import {
  LIVE_CROP_ATTR,
  PHOTO_EFFECTS_NAME,
  photoNodeOf,
} from "@/lib/editor/node-names";
import type { PhotoClip } from "@/lib/photo-effects/mask";

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
  const place = ({ canvas, rect }: EffectBitmap) => {
    if (canvas.width === 0 || canvas.height === 0) {
      return;
    }
    native.drawImage(
      canvas,
      rect.x * scaleX,
      rect.y * scaleY,
      rect.width * scaleX,
      rect.height * scaleY
    );
  };
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
  const radius = element.type === "image" ? element.cornerRadius : 0;
  const shapeId = element.type === "frame" ? element.shape : null;
  const clip = useMemo(
    (): PhotoClip =>
      shapeId === null
        ? { kind: "box", radius }
        : { kind: "shape", path: frameShape(shapeId).path },
    [radius, shapeId]
  );
  usePhotoEffects(shapeRef, element, clip, !cropping);

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
    />
  );
};
