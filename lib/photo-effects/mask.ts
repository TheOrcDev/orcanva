import { cropToPixels } from "@/lib/document/crop";
import { frameShape } from "@/lib/document/frame-shapes";
import type { Size } from "@/lib/document/geometry";
import type { ImageCrop, PhotoElement } from "@/lib/document/schema";
import type { EffectsLayout } from "@/lib/photo-effects/geometry";

// What clips the photo: an image's (rounded) box, or a frame's shape as an
// SVG path in a 1×1 box
export type PhotoClip =
  | { kind: "box"; radius: number }
  | { kind: "shape"; path: string };

// What the effects follow besides the photo's own transparency: the
// (rounded) box of an image, the shape of a frame (a square for a shape
// this version doesn't know, as the frame draws)
export const photoClip = (element: PhotoElement): PhotoClip =>
  element.type === "image"
    ? { kind: "box", radius: element.cornerRadius }
    : { kind: "shape", path: frameShape(element.shape).path };

export type PhotoSource = HTMLImageElement | HTMLCanvasElement;

export interface PhotoMask {
  // The photo's pixels as drawn on the canvas: the photo, or its filtered
  // copy (a filter's blur softens the edge the effects follow)
  source: PhotoSource;
  crop: ImageCrop | null;
  flipX: boolean;
  flipY: boolean;
  box: Size;
  clip: PhotoClip;
}

const sourceSize = (source: PhotoSource): Size =>
  source instanceof HTMLImageElement
    ? { height: source.naturalHeight, width: source.naturalWidth }
    : { height: source.height, width: source.width };

const clipTo = (
  context: CanvasRenderingContext2D,
  clip: PhotoClip,
  size: Size
) => {
  if (clip.kind === "shape") {
    const shape = new Path2D();
    shape.addPath(
      new Path2D(clip.path),
      new DOMMatrix().scale(size.width, size.height)
    );
    context.clip(shape);
    return;
  }
  // Konva caps a corner radius at half the shorter side
  const radius = Math.min(clip.radius, size.width / 2, size.height / 2);
  context.beginPath();
  if (radius > 0) {
    context.roundRect(0, 0, size.width, size.height, radius);
  } else {
    context.rect(0, 0, size.width, size.height);
  }
  context.clip();
};

// Draws what the photo shows (cropped, flipped and clipped, as PhotoNode
// draws it) into `canvas` at the layout's size, the box inset by its pad.
// Only the alpha matters: it's the shape the effects follow.
export const drawPhotoMask = (
  canvas: HTMLCanvasElement,
  { box, clip, crop, flipX, flipY, source }: PhotoMask,
  { pad, scale, size }: EffectsLayout
) => {
  if (canvas.width !== size.width || canvas.height !== size.height) {
    canvas.width = size.width;
    canvas.height = size.height;
  } else {
    canvas.getContext("2d")?.clearRect(0, 0, size.width, size.height);
  }
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }
  const drawn = { height: box.height * scale, width: box.width * scale };
  const scaledClip: PhotoClip =
    clip.kind === "box" ? { ...clip, radius: clip.radius * scale } : clip;
  const part = cropToPixels(crop, sourceSize(source));
  context.save();
  context.translate(pad, pad);
  clipTo(context, scaledClip, drawn);
  context.translate(flipX ? drawn.width : 0, flipY ? drawn.height : 0);
  context.scale(flipX ? -1 : 1, flipY ? -1 : 1);
  context.imageSmoothingQuality = "high";
  context.drawImage(
    source,
    part.x,
    part.y,
    part.width,
    part.height,
    0,
    0,
    drawn.width,
    drawn.height
  );
  context.restore();
};
