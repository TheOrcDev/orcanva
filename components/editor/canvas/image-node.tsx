"use client";

import { PhotoNode } from "@/components/editor/canvas/photo-node";
import type { ImageElement } from "@/lib/document/schema";

export const ImageNode = ({ element }: { element: ImageElement }) => (
  <PhotoNode
    assetId={element.assetId}
    cornerRadius={element.cornerRadius}
    crop={element.crop}
    filter={element.filter}
    flipX={element.flipX}
    flipY={element.flipY}
    height={element.height}
    width={element.width}
  />
);
