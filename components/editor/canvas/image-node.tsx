"use client";

import { Image as KonvaImage, Rect } from "react-konva";

import { useEditor } from "@/components/editor/editor-store-context";
import { useAssetImage } from "@/hooks/use-asset-image";
import type { ImageElement } from "@/lib/document/schema";

const PLACEHOLDER_FILL = "#e4e4e7";
const MISSING_FILL = "#fecaca";

export const ImageNode = ({ element }: { element: ImageElement }) => {
  const url = useEditor(
    (state) => state.assets.find((asset) => asset.id === element.assetId)?.url
  );
  const missing = useEditor((state) =>
    state.missingAssetIds.includes(element.assetId)
  );
  const { image, status } = useAssetImage(url);
  const { cornerRadius, flipX, flipY, height, width } = element;

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
