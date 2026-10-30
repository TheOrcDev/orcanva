import { cutOutBackground } from "@/lib/background-removal/cut-out";
import { findElement, updateElement } from "@/lib/editor/document-ops";
import type { EditorAsset, EditorStoreApi } from "@/lib/editor/store";
import { selectDocument } from "@/lib/editor/store";
import { prepareImage } from "@/lib/upload/prepare-image";
import { uploadImage } from "@/lib/upload/upload-images";

const NAME_SUFFIX = " (no bg)";

const fetchImage = async (asset: EditorAsset): Promise<Blob> => {
  const response = await fetch(asset.url);
  if (!response.ok) {
    throw new Error(`Could not load the image (${response.status})`);
  }
  return response.blob();
};

// Runs the model in the browser, then stores the transparent PNG as a new
// library asset linked to its source
const createCutout = async (
  source: EditorAsset,
  designId: string,
  onProgress?: (percent: number) => void
): Promise<EditorAsset> => {
  const cutout = await cutOutBackground(await fetchImage(source), onProgress);
  const file = new File([cutout.png], `${source.name}${NAME_SUFFIX}.png`, {
    type: "image/png",
  });
  return uploadImage(await prepareImage(file), designId, {
    assetId: source.id,
    variant: "no-background",
  });
};

// Swaps an image element to a background-removed copy of its picture (one
// undo step). The cutout is a new library asset, so the original survives,
// "Restore original" can switch back, and repeats reuse the stored cutout.
export const removeImageBackground = async (
  store: EditorStoreApi,
  elementId: string,
  onProgress?: (percent: number) => void
): Promise<EditorAsset> => {
  const { assets } = store.getState();
  const element = findElement(selectDocument(store.getState()), elementId);
  if (element?.type !== "image") {
    throw new Error("Select an image first");
  }
  const sourceAssetId = element.assetId;
  const source = assets.find((asset) => asset.id === sourceAssetId);
  if (!source) {
    throw new Error("Image not found");
  }

  store.getState().setBackgroundJob(elementId, true);
  try {
    const cutout =
      assets.find((asset) => asset.sourceAssetId === sourceAssetId) ??
      (await createCutout(source, store.getState().designId, onProgress));
    const state = store.getState();
    state.addAsset(cutout);
    // Only swap if the element still shows the image that was processed
    const current = findElement(selectDocument(state), elementId);
    if (current?.type === "image" && current.assetId === sourceAssetId) {
      state.change((doc) =>
        updateElement(doc, elementId, { assetId: cutout.id })
      );
    }
    return cutout;
  } finally {
    store.getState().setBackgroundJob(elementId, false);
  }
};
