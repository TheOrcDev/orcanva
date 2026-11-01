import { coverCrop } from "@/lib/document/crop";
import { createId } from "@/lib/document/factories";
import type { Size } from "@/lib/document/geometry";
import type { DesignDocument, ImageElement } from "@/lib/document/schema";
import {
  findElement,
  insertElement,
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
// frame showing exactly what the frame showed (as a box), and the frame is
// empty again. Returns the new image's id.
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
    groupId: null,
    height: frame.height,
    id: createId(),
    locked: false,
    name: "Image",
    opacity: frame.opacity,
    rotation: frame.rotation,
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
