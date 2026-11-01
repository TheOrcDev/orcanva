"use client";

import { useEffect } from "react";

interface Candidates {
  sizes: string;
  srcSet: string;
}

// Lazy loading skips whichever version of a picture the theme hides, so the
// first switch would wait on the network behind a blur. Once the page has
// loaded and gone quiet, this fetches the hidden version into the cache.
// With the same srcset and sizes the browser picks the very file the hidden
// <img> will ask for, so switching themes shows it at once.
export const WarmHiddenTheme = ({
  dark,
  light,
}: {
  dark: Candidates;
  light: Candidates;
}) => {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let idle: number | undefined;

    const warm = () => {
      const hidden = document.documentElement.classList.contains("dark")
        ? light
        : dark;
      // A loading image stays alive until it finishes, unreferenced or not
      const image = new Image();
      image.sizes = hidden.sizes;
      image.srcset = hidden.srcSet;
    };
    // Safari has no requestIdleCallback
    const whenIdle = () => {
      if ("requestIdleCallback" in window) {
        idle = window.requestIdleCallback(warm, { timeout: 3000 });
      } else {
        timer = setTimeout(warm, 1000);
      }
    };

    if (document.readyState === "complete") {
      whenIdle();
    } else {
      window.addEventListener("load", whenIdle, { once: true });
    }

    return () => {
      window.removeEventListener("load", whenIdle);
      clearTimeout(timer);
      if (idle !== undefined) {
        window.cancelIdleCallback(idle);
      }
    };
  }, [dark, light]);

  return null;
};
