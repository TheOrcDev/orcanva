import { findElement, updateElement } from "@/lib/editor/document-ops";
import type { EditorAsset, EditorStoreApi } from "@/lib/editor/store";
import { selectDocument } from "@/lib/editor/store";

const requestCutout = async (assetId: string): Promise<EditorAsset> => {
  const response = await fetch(`/api/assets/${assetId}/remove-background`, {
    method: "POST",
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body
        ? String(body.error)
        : `Request failed with ${response.status}`;
    throw new Error(message);
  }
  return body as EditorAsset;
};

// Swaps an image element to a background-removed copy of its picture (one
// undo step). The cutout is a new library asset, so the original survives
// and "Restore original" can switch back.
export const removeImageBackground = async (
  store: EditorStoreApi,
  elementId: string
): Promise<EditorAsset> => {
  const element = findElement(selectDocument(store.getState()), elementId);
  if (element?.type !== "image") {
    throw new Error("Select an image first");
  }
  const sourceAssetId = element.assetId;

  store.getState().setBackgroundJob(elementId, true);
  try {
    const cutout = await requestCutout(sourceAssetId);
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
