"use client";

import { useCallback, useEffect, useRef } from "react";

import { usePageNodeRef } from "@/components/editor/canvas-context";
import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import { createThumbnailer } from "@/lib/export/thumbnailer";
import type { Thumbnailer } from "@/lib/export/thumbnailer";

// Images and fonts need a moment on first open before the preview is useful
const INITIAL_THUMBNAIL_DELAY_MS = 1500;

// Keeps the gallery preview current: re-renders a small JPEG once editing
// goes idle. Returns a flush for the back button.
export const useThumbnail = (hasThumbnail: boolean): (() => Promise<void>) => {
  const store = useEditorStoreApi();
  const pageNodeRef = usePageNodeRef();
  const thumbnailerRef = useRef<Thumbnailer | null>(null);
  const getPageNode = useCallback(() => pageNodeRef.current, [pageNodeRef]);

  useEffect(() => {
    const thumbnailer = createThumbnailer({
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
  }, [store, hasThumbnail, getPageNode]);

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
