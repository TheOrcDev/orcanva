"use client";

import { useEffect } from "react";

import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import {
  MAX_ASSET_LOOKUP,
  createAssetResolver,
  unknownAssetIds,
} from "@/lib/editor/asset-resolver";
import { setAssetResolver } from "@/lib/editor/image-cache";
import { selectDocument } from "@/lib/editor/store";
import type { EditorAsset, EditorStore } from "@/lib/editor/store";

const fetchAssets = async (
  designId: string,
  ids: string[]
): Promise<EditorAsset[]> => {
  const response = await fetch(
    `/api/designs/${designId}/assets?ids=${ids.join(",")}`
  );
  if (!response.ok) {
    throw new Error(`Asset lookup failed with ${response.status}`);
  }
  const { assets }: { assets: EditorAsset[] } = await response.json();
  return assets;
};

const lookupAll = async (
  designId: string,
  ids: string[]
): Promise<EditorAsset[]> => {
  const chunks: string[][] = [];
  for (let start = 0; start < ids.length; start += MAX_ASSET_LOOKUP) {
    chunks.push(ids.slice(start, start + MAX_ASSET_LOOKUP));
  }
  const results = await Promise.all(
    chunks.map((chunk) => fetchAssets(designId, chunk))
  );
  return results.flat();
};

// Looks up images the editor can't draw yet, such as one a collaborator
// just uploaded, so they show up instead of a "missing" box
export const useAssetResolver = (): void => {
  const store = useEditorStoreApi();

  useEffect(() => {
    const { designId } = store.getState();
    const resolver = createAssetResolver({
      lookup: (ids) => lookupAll(designId, ids),
      onFound: (assets) => store.getState().addAssets(assets),
      onMissing: (ids) => store.getState().markAssetsMissing(ids),
    });

    const check = (state: EditorStore) => {
      const ids = unknownAssetIds(
        selectDocument(state),
        state.assets,
        (id) => resolver.isPending(id) || state.missingAssetIds.includes(id)
      );
      if (ids.length > 0) {
        resolver.resolve(ids).catch(() => null);
      }
    };

    setAssetResolver(resolver.resolve);
    check(store.getState());
    const unsubscribe = store.subscribe((state, previous) => {
      if (state.doc !== previous.doc || state.assets !== previous.assets) {
        check(state);
      }
    });
    return () => {
      unsubscribe();
      setAssetResolver(null);
    };
  }, [store]);
};
