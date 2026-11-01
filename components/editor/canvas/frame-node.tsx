"use client";

import { useMemo } from "react";
import { Group, Path } from "react-konva";

import { PhotoNode } from "@/components/editor/canvas/photo-node";
import { frameShape } from "@/lib/document/frame-shapes";
import type { FrameElement } from "@/lib/document/schema";

// Waiting for a photo: the shape in a soft grey, also in downloads
const EMPTY_FILL = "#d4d4d8";

// The frame's shape at its size, for clipping its photo
const scaledPath = (path: string, width: number, height: number): Path2D => {
  const scaled = new Path2D();
  scaled.addPath(new Path2D(path), new DOMMatrix().scale(width, height));
  return scaled;
};

export const FrameNode = ({ element }: { element: FrameElement }) => {
  const { assetId, height, width } = element;
  const { path } = frameShape(element.shape);
  const clip = useMemo(
    () => scaledPath(path, width, height),
    [path, width, height]
  );

  if (!assetId) {
    return (
      <Path data={path} scaleX={width} scaleY={height} fill={EMPTY_FILL} />
    );
  }

  return (
    <Group clipFunc={() => [clip]}>
      <PhotoNode
        assetId={assetId}
        cornerRadius={0}
        crop={element.crop}
        filter={element.filter}
        flipX={element.flipX}
        flipY={element.flipY}
        height={height}
        width={width}
      />
    </Group>
  );
};
