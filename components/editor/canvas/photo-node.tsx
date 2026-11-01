"use client";

import type Konva from "konva";
import { useRef } from "react";
import { Image as KonvaImage, Rect } from "react-konva";

import { useEditor } from "@/components/editor/editor-store-context";
import { useAssetImage } from "@/hooks/use-asset-image";
import { useFilteredImage } from "@/hooks/use-filtered-image";
import type { ImageCrop, ImageFilter } from "@/lib/document/schema";

const PLACEHOLDER_FILL = "#e4e4e7";
const MISSING_FILL = "#fecaca";

export interface PhotoNodeProps {
  assetId: string;
  width: number;
  height: number;
  crop: ImageCrop | null;
  filter: ImageFilter | null;
  flipX: boolean;
  flipY: boolean;
  cornerRadius: number;
}

// A photo drawn into a box: cropped, filtered and flipped. Images and
// frames both draw their photo with it.
export const PhotoNode = ({
  assetId,
  cornerRadius,
  crop,
  filter,
  flipX,
  flipY,
  height,
  width,
}: PhotoNodeProps) => {
  const url = useEditor(
    (state) => state.assets.find((asset) => asset.id === assetId)?.url
  );
  const missing = useEditor((state) => state.missingAssetIds.includes(assetId));
  const { image, status } = useAssetImage(url);
  const imageRef = useRef<Konva.Image>(null);
  useFilteredImage(imageRef, image, filter, { height, width }, crop);

  if (!image) {
    return (
      <Rect
        width={width}
        height={height}
        cornerRadius={cornerRadius}
        fill={status === "error" || missing ? MISSING_FILL : PLACEHOLDER_FILL}
      />
    );
  }

  // Mirrored inside the element box, so x/y/size semantics never change
  return (
    <KonvaImage
      ref={imageRef}
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
