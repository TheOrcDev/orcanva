"use client";

import { useEffect, useRef, useState } from "react";

import { usePageRenderer } from "@/components/editor/canvas/static-page";
import type { PageView } from "@/lib/collab/changeset";
import type { DesignDocument } from "@/lib/document/schema";

const THUMBNAIL_QUALITY = 0.8;
// How long a page must stay unchanged before it's drawn again, so typing or
// a slider scrub doesn't redraw it on every step
const THUMBNAIL_DELAY_MS = 600;

interface Drawn {
  document: DesignDocument;
  url: string;
}

// A small picture of every page for the page strip, by page id, drawn off
// screen the way Download draws (photos, filters, effects and all) to fit
// `box` (CSS px). A page is drawn again a moment after it changes, one page
// at a time; until then its last picture stays up. Pictures are blob URLs,
// revoked once replaced or their page is gone.
export const usePageThumbnails = (
  pages: readonly PageView[],
  box: { width: number; height: number }
): ReadonlyMap<string, string> => {
  const render = usePageRenderer();
  const [urls, setUrls] = useState<ReadonlyMap<string, string>>(new Map());
  const drawn = useRef(new Map<string, Drawn>());

  useEffect(() => {
    const controller = new AbortController();
    const publish = () =>
      setUrls(new Map([...drawn.current].map(([id, item]) => [id, item.url])));
    // Pages that are gone
    const live = new Set(pages.map((page) => page.id));
    let removed = false;
    for (const [id, item] of drawn.current) {
      if (!live.has(id)) {
        URL.revokeObjectURL(item.url);
        drawn.current.delete(id);
        removed = true;
      }
    }
    if (removed) {
      publish();
    }

    const stale = pages.filter(
      (page) => drawn.current.get(page.id)?.document !== page.doc.document
    );
    if (stale.length === 0) {
      return () => controller.abort();
    }
    const scale = window.devicePixelRatio || 1;
    const draw = async (page: PageView) => {
      const { document } = page.doc;
      const blob = await render(
        document,
        {
          format: "jpeg",
          pixelRatio: Math.min(
            1,
            (box.width * scale) / document.width,
            (box.height * scale) / document.height
          ),
          quality: THUMBNAIL_QUALITY,
        },
        controller.signal
      );
      if (controller.signal.aborted) {
        return;
      }
      const old = drawn.current.get(page.id);
      if (old) {
        URL.revokeObjectURL(old.url);
      }
      drawn.current.set(page.id, {
        document,
        url: URL.createObjectURL(blob),
      });
      publish();
    };
    // A first picture shows at once; later ones wait for edits to settle
    const firstTime = stale.some((page) => !drawn.current.has(page.id));
    const timer = setTimeout(
      () => {
        Promise.allSettled(stale.map(draw)).catch(() => null);
      },
      firstTime ? 0 : THUMBNAIL_DELAY_MS
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [pages, box.width, box.height, render]);

  useEffect(() => {
    const { current } = drawn;
    return () => {
      for (const item of current.values()) {
        URL.revokeObjectURL(item.url);
      }
      current.clear();
    };
  }, []);

  return urls;
};
