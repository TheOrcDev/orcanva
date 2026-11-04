import Konva from "konva";

import type { Size } from "@/lib/document/geometry";
import { BACKGROUND_NODE_NAME } from "@/lib/editor/node-names";

export type ExportFormat = "png" | "jpeg" | "webp";

export const EXPORT_MIME_TYPES: Record<ExportFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export const EXPORT_EXTENSIONS: Record<ExportFormat, string> = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
};

export interface RenderOptions {
  format: ExportFormat;
  // Output pixels per design pixel (1 = exact design size)
  pixelRatio: number;
  // 0–1, ignored for PNG
  quality?: number;
  // Leave the page background out (PNG/WebP only)
  transparent?: boolean;
}

// Renders the page from an offscreen clone at scale 1 so output size is
// exactly design size × pixelRatio, with no zoom rounding or UI layers.
export const renderPage = async (
  pageNode: Konva.Group,
  page: Size,
  options: RenderOptions
): Promise<Blob> => {
  const container = document.createElement("div");
  const stage = new Konva.Stage({
    container,
    height: page.height,
    width: page.width,
  });

  try {
    const layer = new Konva.Layer({ listening: false });
    stage.add(layer);
    const clone = pageNode.clone({
      clipHeight: page.height,
      clipWidth: page.width,
      clipX: 0,
      clipY: 0,
      scaleX: 1,
      scaleY: 1,
      x: 0,
      y: 0,
    });
    if (options.transparent && options.format !== "jpeg") {
      for (const node of clone.find(`.${BACKGROUND_NODE_NAME}`)) {
        node.visible(false);
      }
    }
    layer.add(clone);

    const blob = await stage.toBlob({
      height: page.height,
      mimeType: EXPORT_MIME_TYPES[options.format],
      pixelRatio: options.pixelRatio,
      quality: options.quality,
      width: page.width,
      x: 0,
      y: 0,
    });
    if (!(blob instanceof Blob)) {
      throw new TypeError("Canvas export produced no image");
    }
    return blob;
  } finally {
    stage.destroy();
  }
};

export const THUMBNAIL_MAX_SIZE = 640;
export const THUMBNAIL_QUALITY = 0.8;

export const renderThumbnail = (
  pageNode: Konva.Group,
  page: Size
): Promise<Blob> =>
  renderPage(pageNode, page, {
    format: "jpeg",
    pixelRatio: Math.min(
      1,
      THUMBNAIL_MAX_SIZE / Math.max(page.width, page.height)
    ),
    quality: THUMBNAIL_QUALITY,
  });

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Give the browser a tick to start the download before revoking
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};
