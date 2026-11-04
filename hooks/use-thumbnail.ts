"use client";

import type Konva from "konva";
import { useCallback, useEffect, useRef } from "react";

import { usePageNodeRef } from "@/components/editor/canvas-context";
import { usePageRenderer } from "@/components/editor/canvas/static-page";
import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import type { DesignDocument } from "@/lib/document/schema";
import { prepareForRender } from "@/lib/export/prepare";
import {
  THUMBNAIL_MAX_SIZE,
  THUMBNAIL_QUALITY,
  renderThumbnail,
} from "@/lib/export/render-page";
import { createThumbnailer } from "@/lib/export/thumbnailer";
import type { Thumbnailer } from "@/lib/export/thumbnailer";

// Images and fonts need a moment on first open before the preview is useful
const INITIAL_THUMBNAIL_DELAY_MS = 1500;

// The canvas's page, once what it shows has loaded
const drawCanvas = async (
  node: Konva.Group,
  document: DesignDocument
): Promise<Blob> => {
  await prepareForRender(document);
  return renderThumbnail(node, document);
};

// Keeps the gallery preview (the first page) current: re-renders a small
// JPEG once editing goes idle. Returns a flush for the back button.
export const useThumbnail = (hasThumbnail: boolean): (() => Promise<void>) => {
  const store = useEditorStoreApi();
  const pageNodeRef = usePageNodeRef();
  const render = usePageRenderer();
  const thumbnailerRef = useRef<Thumbnailer | null>(null);
  const getPageNode = useCallback(() => pageNodeRef.current, [pageNodeRef]);

  useEffect(() => {
    const thumbnailer = createThumbnailer({
      drawCanvas,
      // The first page while another is on screen
      drawOffscreen: (document) =>
        render(document, {
          format: "jpeg",
          pixelRatio: Math.min(
            1,
            THUMBNAIL_MAX_SIZE / Math.max(document.width, document.height)
          ),
          quality: THUMBNAIL_QUALITY,
        }),
      getPageNode,
      hasThumbnail,
      store,
    });
    thumbnailerRef.current = thumbnailer;

    // Only this session's own edits: every open window re-rendering the
    // preview for every remote change would be wasted work
    const unsubscribe = store.subscribe((state, previous) => {
      if (state.seq !== previous.seq) {
        thumbnailer.schedule();
      }
    });
    if (!hasThumbnail) {
      thumbnailer.schedule(INITIAL_THUMBNAIL_DELAY_MS);
    }

    return () => {
      unsubscribe();
      thumbnailer.dispose();
      thumbnailerRef.current = null;
    };
  }, [store, hasThumbnail, getPageNode, render]);

  const flush = useCallback(async () => {
    await thumbnailerRef.current?.flush();
  }, []);

  // A restore redraws the gallery preview from the restored design
  useEffect(() => {
    store.getState().setFlushThumbnail(flush);
    return () => store.getState().setFlushThumbnail(null);
  }, [flush, store]);

  return flush;
};
