"use client";

import { useEffect, useState } from "react";

import { getLoadedImage, loadImage } from "@/lib/editor/image-cache";

export type AssetImageState =
  | { status: "loading"; image: undefined }
  | { status: "ready"; image: HTMLImageElement }
  | { status: "error"; image: undefined };

const LOADING: AssetImageState = { image: undefined, status: "loading" };

const initialState = (url: string | undefined): AssetImageState => {
  const image = url ? getLoadedImage(url) : undefined;
  return image ? { image, status: "ready" } : LOADING;
};

export const useAssetImage = (url: string | undefined): AssetImageState => {
  const [state, setState] = useState<{ url?: string; value: AssetImageState }>(
    () => ({ url, value: initialState(url) })
  );

  // Reset synchronously when the URL changes (derived state, not an effect)
  let current = state;
  if (state.url !== url) {
    current = { url, value: initialState(url) };
    setState(current);
  }

  useEffect(() => {
    if (!url || getLoadedImage(url)) {
      return;
    }
    let active = true;
    const load = async () => {
      try {
        const image = await loadImage(url);
        if (active) {
          setState({ url, value: { image, status: "ready" } });
        }
      } catch {
        if (active) {
          setState({ url, value: { image: undefined, status: "error" } });
        }
      }
    };
    load().catch(() => null);
    return () => {
      active = false;
    };
  }, [url]);

  return current.value;
};
