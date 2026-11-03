"use client";

import type Konva from "konva";
import { useRef } from "react";
import { Image as KonvaImage, Rect } from "react-konva";

import { useEditor } from "@/components/editor/editor-store-context";
import { useAssetImage } from "@/hooks/use-asset-image";
import { useFilteredImage } from "@/hooks/use-filtered-image";
import type { ImageCrop, ImageFilter } from "@/lib/document/schema";
import { PHOTO_NODE_NAME } from "@/lib/editor/node-names";
import type { FilterSource } from "@/lib/image-filters/renderer";

const PLACEHOLDER_FILL = "#e4e4e7";
const MISSING_FILL = "#fecaca";

interface PhotoLook {
  width: number;
  height: number;
  crop: ImageCrop | null;
  filter: ImageFilter | null;
  flipX: boolean;
  flipY: boolean;
  cornerRadius: number;
}

export interface PhotoNodeProps extends PhotoLook {
  assetId: string;
}

// A picture drawn into a box the way a photo is: cropped, filtered and
// flipped. `name` marks the element's own photo (see photoNodeOf); the
// magic eraser draws its work in progress with it too, unnamed.
export const PhotoImage = ({
  cornerRadius,
  crop,
  filter,
  flipX,
  flipY,
  height,
  image,
  name,
  width,
}: PhotoLook & { image: FilterSource; name?: string }) => {
  const imageRef = useRef<Konva.Image>(null);
  useFilteredImage(imageRef, image, filter, { height, width }, crop);

  // Mirrored inside the element box, so x/y/size semantics never change
  return (
    <KonvaImage
      ref={imageRef}
      name={name}
      image={image}
      width={width}
      height={height}
      cornerRadius={cornerRadius}
      x={flipX ? width : 0}
      y={flipY ? height : 0}
      scaleX={flipX ? -1 : 1}
      scaleY={flipY ? -1 : 1}
    />
  );
};

// An element's photo, from its asset. Images and frames both draw their
// photo with it.
export const PhotoNode = ({ assetId, ...look }: PhotoNodeProps) => {
  const url = useEditor(
    (state) => state.assets.find((asset) => asset.id === assetId)?.url
  );
  const missing = useEditor((state) => state.missingAssetIds.includes(assetId));
  const { image, status } = useAssetImage(url);

  if (!image) {
    return (
      <Rect
        width={look.width}
        height={look.height}
        cornerRadius={look.cornerRadius}
        fill={status === "error" || missing ? MISSING_FILL : PLACEHOLDER_FILL}
      />
    );
  }
  return <PhotoImage {...look} image={image} name={PHOTO_NODE_NAME} />;
};
