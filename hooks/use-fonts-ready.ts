"use client";

import { useEffect, useReducer } from "react";

import { ensureFont, isFontReady } from "@/lib/fonts/loader";
import type { FontRequest } from "@/lib/fonts/loader";

// Loads every face a text draws with (its marks can use other fonts and
// weights) and re-renders as they arrive. Callers check isFontReady per
// face and draw a fallback family until then.
export const useFontsReady = (requests: readonly FontRequest[]): void => {
  const [, rerender] = useReducer((count: number) => count + 1, 0);
  // Stands for the requests, so a new array with the same faces is no change
  const key = JSON.stringify(requests);

  useEffect(() => {
    const wanted = JSON.parse(key) as FontRequest[];
    const missing = wanted.filter((request) => !isFontReady(request));
    if (missing.length === 0) {
      return;
    }
    let active = true;
    const load = async () => {
      await Promise.allSettled(missing.map(ensureFont));
      if (active) {
        rerender();
      }
    };
    load().catch(() => null);
    return () => {
      active = false;
    };
  }, [key]);
};
