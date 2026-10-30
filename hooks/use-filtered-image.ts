"use client";

import type Konva from "konva";
import { useEffect, useLayoutEffect, useRef } from "react";
import type { RefObject } from "react";

import { toast } from "@/components/ui/toast";
import type { Size } from "@/lib/document/geometry";
import type { ImageFilter } from "@/lib/document/schema";
import { filterOutputSize } from "@/lib/image-filters/output-size";
import { maxFilterSide, renderFilter } from "@/lib/image-filters/renderer";
import { resolveFilter, toUniforms } from "@/lib/image-filters/resolve";

let warnedUnsupported = false;

const warnUnsupported = () => {
  if (warnedUnsupported) {
    return;
  }
  warnedUnsupported = true;
  toast.add({
    description: "This browser has no WebGL2, so images show without them.",
    title: "Filters can't be shown",
    type: "error",
  });
};

const release = (canvas: HTMLCanvasElement | null) => {
  if (canvas) {
    canvas.width = 0;
    canvas.height = 0;
  }
};

// Points the Konva image at its filtered pixels. The node renders the plain
// photo as its `image` prop; when the element has a filter, a canvas with the
// filter applied replaces it on the node. The canvas is redrawn in place on
// every change (no allocation per slider tick) and the export clone shares
// it, so downloads and thumbnails come out filtered too.
export const useFilteredImage = (
  nodeRef: RefObject<Konva.Image | null>,
  image: HTMLImageElement | undefined,
  filter: ImageFilter | null,
  box: Size
) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Unfiltered photos never touch the GPU
  const output =
    image && resolveFilter(filter)
      ? filterOutputSize(
          { height: image.naturalHeight, width: image.naturalWidth },
          box,
          maxFilterSide()
        )
      : null;
  const outputWidth = output?.width ?? 0;
  const outputHeight = output?.height ?? 0;

  useLayoutEffect(() => {
    const node = nodeRef.current;
    if (!node || !image) {
      return;
    }
    const resolved = resolveFilter(filter);
    let source: HTMLImageElement | HTMLCanvasElement = image;
    if (resolved) {
      const canvas = canvasRef.current ?? document.createElement("canvas");
      canvasRef.current = canvas;
      if (canvas.width !== outputWidth || canvas.height !== outputHeight) {
        canvas.width = outputWidth;
        canvas.height = outputHeight;
      }
      if (renderFilter(image, toUniforms(resolved), canvas)) {
        source = canvas;
      } else {
        warnUnsupported();
      }
    }
    if (node.image() !== source) {
      node.image(source);
    }
    if (source === image) {
      // Hand the pixels back as soon as the filter is gone
      release(canvasRef.current);
    }
    node.getLayer()?.batchDraw();
  }, [nodeRef, image, filter, outputWidth, outputHeight]);

  useEffect(() => () => release(canvasRef.current), []);
};
