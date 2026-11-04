"use client";

import { useEffect, useRef, useState } from "react";

import { usePageRenderer } from "@/components/editor/canvas/static-page";
import { useEditor } from "@/components/editor/editor-store-context";
import type { Size } from "@/lib/document/geometry";
import { resizeWithLayout } from "@/lib/editor/magic-resize";
import type { ResizeLayout } from "@/lib/editor/magic-resize";
import { measureInBrowser } from "@/lib/editor/resize-design";
import { selectDocument } from "@/lib/editor/store";
import { waitForFonts } from "@/lib/fonts/loader";

// The longer side of a preview, in image px (about 160 CSS px on a 2×
// screen)
export const PREVIEW_SIDE = 320;
const PREVIEW_QUALITY = 0.8;
// How long the choices must settle before drawing
const PREVIEW_DELAY_MS = 250;

export interface PreviewSize extends Size {
  id: string;
}

// The design laid out at each size, as a small picture drawn off screen
// the way Download would draw it, by id. Drawn again (one page at a time)
// when the sizes, the layout or the design change; until then the last
// picture of a size stays up. Pictures are blob URLs, revoked once
// replaced or no longer shown.
export const useResizePreviews = (
  sizes: readonly PreviewSize[],
  layout: ResizeLayout
): ReadonlyMap<string, string> => {
  const render = usePageRenderer();
  const document = useEditor(selectDocument);
  const [urls, setUrls] = useState<ReadonlyMap<string, string>>(new Map());
  const shown = useRef(new Map<string, string>());
  // Stands for the sizes, so a new array of the same sizes is no change
  const key = JSON.stringify(sizes);

  useEffect(() => {
    const wanted = JSON.parse(key) as PreviewSize[];
    const controller = new AbortController();
    const show = (id: string, url: string | null) => {
      const old = shown.current.get(id);
      if (old) {
        URL.revokeObjectURL(old);
      }
      if (url) {
        shown.current.set(id, url);
      } else {
        shown.current.delete(id);
      }
      setUrls(new Map(shown.current));
    };
    // Sizes no longer ticked
    for (const id of shown.current.keys()) {
      if (!wanted.some((size) => size.id === id)) {
        show(id, null);
      }
    }
    const draw = async (size: PreviewSize) => {
      const laid = resizeWithLayout(document, size, layout, measureInBrowser);
      const blob = await render(
        laid,
        {
          format: "jpeg",
          pixelRatio: Math.min(
            1,
            PREVIEW_SIDE / Math.max(size.width, size.height)
          ),
          quality: PREVIEW_QUALITY,
        },
        controller.signal
      );
      if (!controller.signal.aborted) {
        show(size.id, URL.createObjectURL(blob));
      }
    };
    const timer = setTimeout(async () => {
      // Measured in a fallback font, text would wrap wrongly
      await waitForFonts(document).catch(() => null);
      if (controller.signal.aborted) {
        return;
      }
      await Promise.allSettled(wanted.map(draw));
    }, PREVIEW_DELAY_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [document, key, layout, render]);

  useEffect(() => {
    const { current } = shown;
    return () => {
      for (const url of current.values()) {
        URL.revokeObjectURL(url);
      }
      current.clear();
    };
  }, []);

  return urls;
};
