"use client";

import { useEffect } from "react";

import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import { setAssetUrls } from "@/lib/editor/image-cache";

// Keeps the export image-preloader's assetId → URL map current
export const useAssetUrlSync = () => {
  const store = useEditorStoreApi();

  useEffect(() => {
    setAssetUrls(store.getState().assets);
    return store.subscribe((state, previous) => {
      if (state.assets !== previous.assets) {
        setAssetUrls(state.assets);
      }
    });
  }, [store]);
};
