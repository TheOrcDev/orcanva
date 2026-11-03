import { cutOutBackground } from "@/lib/background-removal/cut-out";
import { findVariant } from "@/lib/editor/asset-variants";
import {
  fetchAssetImage,
  saveDerivedImage,
  sourcePhoto,
  swapPhoto,
} from "@/lib/editor/derived-images";
import type { EditorAsset, EditorStoreApi } from "@/lib/editor/store";

// Runs the model in the browser, then stores the transparent PNG as a new
// library asset linked to its source
const createCutout = async (
  store: EditorStoreApi,
  source: EditorAsset,
  onProgress?: (percent: number) => void
): Promise<EditorAsset> => {
  const cutout = await cutOutBackground(
    await fetchAssetImage(source),
    onProgress
  );
  return saveDerivedImage(
    store,
    cutout.png,
    source,
    "no-background",
    " (no bg)"
  );
};

// Swaps an image element to a background-removed copy of its picture (one
// undo step). The cutout is a new library asset, so the original survives,
// "Restore original" can switch back, and repeats reuse the stored cutout.
export const removeImageBackground = async (
  store: EditorStoreApi,
  elementId: string,
  onProgress?: (percent: number) => void
): Promise<EditorAsset> => {
  const source = sourcePhoto(store, elementId);
  store.getState().setImageJob(elementId, "background");
  try {
    const cutout =
      findVariant(store.getState().assets, source.id, "no-background") ??
      (await createCutout(store, source, onProgress));
    swapPhoto(store, elementId, source.id, cutout);
    return cutout;
  } finally {
    store.getState().setImageJob(elementId, null);
  }
};
