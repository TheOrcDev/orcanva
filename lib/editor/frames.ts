import { coverCrop } from "@/lib/document/crop";
import { createId } from "@/lib/document/factories";
import type { Size } from "@/lib/document/geometry";
import type {
  DesignDocument,
  ImageElement,
  PhotoEffects,
} from "@/lib/document/schema";
import {
  findElement,
  insertElement,
  removeElements,
  updateElement,
} from "@/lib/editor/document-ops";

// Puts a photo in a frame, cropped from the middle to cover it. The photo
// starts plain: no filter, no flips.
export const fillFrame = (
  document: DesignDocument,
  frameId: string,
  photo: Size & { id: string }
): DesignDocument => {
  const frame = findElement(document, frameId);
  if (frame?.type !== "frame") {
    return document;
  }
  return updateElement(document, frameId, {
    assetId: photo.id,
    crop: coverCrop(photo, frame),
    filter: null,
    flipX: false,
    flipY: false,
  });
};

// Takes the photo out of a frame: it becomes an image right above the
// frame showing exactly what the frame showed (as a box), effects included,
// and the frame is empty again. The frame keeps its effects for the next
// photo (an empty frame draws none). Returns the new image's id.
export const detachPhoto = (
  document: DesignDocument,
  frameId: string
): { document: DesignDocument; imageId: string | null } => {
  const frame = findElement(document, frameId);
  if (frame?.type !== "frame" || !frame.assetId) {
    return { document, imageId: null };
  }
  const photo: ImageElement = {
    assetId: frame.assetId,
    cornerRadius: 0,
    crop: frame.crop,
    filter: frame.filter,
    flipX: frame.flipX,
    flipY: frame.flipY,
    glow: frame.glow,
    groupId: null,
    height: frame.height,
    id: createId(),
    locked: false,
    name: "Image",
    opacity: frame.opacity,
    outline: frame.outline,
    rotation: frame.rotation,
    shadow: frame.shadow,
    type: "image",
    visible: true,
    width: frame.width,
    x: frame.x,
    y: frame.y,
  };
  const emptied = updateElement(document, frameId, {
    assetId: null,
    crop: null,
    filter: null,
    flipX: false,
    flipY: false,
  });
  const index = emptied.elements.findIndex((element) => element.id === frameId);
  return {
    document: insertElement(emptied, photo, index + 1),
    imageId: photo.id,
  };
};

const hasEffects = ({ glow, outline, shadow }: PhotoEffects): boolean =>
  glow !== null || outline !== null || shadow !== null;

// Moves an image's photo into a frame (keeping its filter and flips) and
// removes the image, as dropping one on a frame does. A frame with effects
// of its own keeps them; otherwise it takes the image's. `photo` is the
// photo's own size.
export const photoIntoFrame = (
  document: DesignDocument,
  imageId: string,
  frameId: string,
  photo: Size
): DesignDocument => {
  const image = findElement(document, imageId);
  if (image?.type !== "image") {
    return document;
  }
  const filled = fillFrame(document, frameId, { ...photo, id: image.assetId });
  if (filled === document) {
    return document;
  }
  const frame = findElement(document, frameId);
  const effects =
    frame?.type === "frame" && hasEffects(frame)
      ? {}
      : { glow: image.glow, outline: image.outline, shadow: image.shadow };
  const styled = updateElement(filled, frameId, {
    ...effects,
    filter: image.filter,
    flipX: image.flipX,
    flipY: image.flipY,
  });
  return removeElements(styled, [imageId]);
};
