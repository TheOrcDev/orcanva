"use client";

import { useEffect, useReducer } from "react";

import { ensureFont, isFontReady } from "@/lib/fonts/loader";
import type { FontRequest } from "@/lib/fonts/loader";

// True once the exact face (and the subsets the text needs) is loaded.
// Callers render a fallback family until then; flipping fontFamily is what
// makes Konva re-measure the text with the real font.
export const useFontReady = ({
  fontId,
  italic,
  text,
  weight,
}: FontRequest): boolean => {
  const [, rerender] = useReducer((count: number) => count + 1, 0);

  useEffect(() => {
    const request = { fontId, italic, text, weight };
    if (isFontReady(request)) {
      return;
    }
    let active = true;
    const load = async () => {
      try {
        await ensureFont(request);
      } catch {
        // Keep rendering the fallback family; exports retry the load
      }
      if (active) {
        rerender();
      }
    };
    load().catch(() => null);
    return () => {
      active = false;
    };
  }, [fontId, italic, text, weight]);

  return isFontReady({ fontId, italic, text, weight });
};
