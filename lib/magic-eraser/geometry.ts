import { cropOrFull } from "@/lib/document/crop";
import type { Point, Size } from "@/lib/document/geometry";
import type { ImageCrop } from "@/lib/document/schema";

// How a photo sits in an element's box: the part `crop` keeps, stretched
// over the box, mirrored by the flips. The eraser paints in the photo's own
// pixels, so its mask lines up with the file whatever the element does.
export interface PhotoPlacement {
  box: Size;
  crop: ImageCrop | null;
  flipX: boolean;
  flipY: boolean;
  // The photo's own size in pixels
  photo: Size;
}

// A point in the element's own space (0…width, 0…height) as a pixel of the
// photo
export const localToAsset = (
  point: Point,
  { box, crop, flipX, flipY, photo }: PhotoPlacement
): Point => {
  const { height, width, x, y } = cropOrFull(crop);
  const across = (flipX ? box.width - point.x : point.x) / box.width;
  const down = (flipY ? box.height - point.y : point.y) / box.height;
  return {
    x: (x + across * width) * photo.width,
    y: (y + down * height) * photo.height,
  };
};

// The same placement the other way, as a group transform: whatever is drawn
// in photo pixels inside a group with these attributes lands where it shows
// in the element
export const assetToLocal = ({
  box,
  crop,
  flipX,
  flipY,
  photo,
}: PhotoPlacement): {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
} => {
  const { height, width, x, y } = cropOrFull(crop);
  const scaleX = box.width / (width * photo.width);
  const scaleY = box.height / (height * photo.height);
  const offsetX = x * photo.width * scaleX;
  const offsetY = y * photo.height * scaleY;
  return {
    scaleX: flipX ? -scaleX : scaleX,
    scaleY: flipY ? -scaleY : scaleY,
    x: flipX ? box.width + offsetX : -offsetX,
    y: flipY ? box.height + offsetY : -offsetY,
  };
};
