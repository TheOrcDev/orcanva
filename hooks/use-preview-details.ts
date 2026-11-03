"use client";

import { useCallback, useState } from "react";

import { loadDetails, saveDetails } from "@/lib/youtube-preview/details";
import type { PreviewDetails } from "@/lib/youtube-preview/details";

// The YouTube preview's channel, picture, length and look, as this browser
// last left them. Reads localStorage on the first render, so it belongs in
// components that only render in the browser.
export const usePreviewDetails = () => {
  const [details, setDetails] = useState(() => loadDetails());
  const change = useCallback((next: PreviewDetails) => {
    setDetails(next);
    saveDetails(next);
  }, []);
  return [details, change] as const;
};
