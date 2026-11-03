import type { AssetVariant } from "@/lib/assets/variants";
import type { DesignElement } from "@/lib/document/schema";
import { findElement, updateElement } from "@/lib/editor/document-ops";
import type { EditorAsset, EditorStoreApi } from "@/lib/editor/store";
import { selectDocument } from "@/lib/editor/store";
import { UPLOAD_MIME_TYPES, isUploadMimeType } from "@/lib/storage/keys";
import { prepareImage } from "@/lib/upload/prepare-image";
import { uploadImage } from "@/lib/upload/upload-images";

// What the AI tools share: each reads the photo an image or frame shows,
// makes a new picture from it in the browser, and stores that as a new
// asset linked to its source (lib/assets/variants.ts), so the original
// survives and Restore original can go back to it.

// The asset an image or a filled frame shows
export const photoAssetId = (
  element: DesignElement | undefined
): string | null =>
  element?.type === "image" || element?.type === "frame"
    ? element.assetId
    : null;

export const fetchAssetImage = async (asset: EditorAsset): Promise<Blob> => {
  const response = await fetch(asset.url);
  if (!response.ok) {
    throw new Error(`Could not load the image (${response.status})`);
  }
  return response.blob();
};

// The photo an element shows, for a tool to work on
export const sourcePhoto = (
  store: EditorStoreApi,
  elementId: string
): EditorAsset => {
  const state = store.getState();
  const assetId = photoAssetId(findElement(selectDocument(state), elementId));
  if (!assetId) {
    throw new Error("Select an image first");
  }
  const source = state.assets.find((asset) => asset.id === assetId);
  if (!source) {
    throw new Error("Image not found");
  }
  return source;
};

// Uploads a result into the library as `variant` of `source`, named after
// it ("Beach (2×).jpg")
export const saveDerivedImage = async (
  store: EditorStoreApi,
  image: Blob,
  source: EditorAsset,
  variant: AssetVariant,
  suffix: string
): Promise<EditorAsset> => {
  const extension = isUploadMimeType(image.type)
    ? UPLOAD_MIME_TYPES[image.type]
    : "png";
  const file = new File([image], `${source.name}${suffix}.${extension}`, {
    type: image.type,
  });
  return uploadImage(await prepareImage(file), store.getState().designId, {
    assetId: source.id,
    variant,
  });
};

// Shows `result` in place of `sourceId` (one undo step), but only if the
// element still shows that photo: someone may have changed it meanwhile
export const swapPhoto = (
  store: EditorStoreApi,
  elementId: string,
  sourceId: string,
  result: EditorAsset
): void => {
  const state = store.getState();
  state.addAsset(result);
  const current = findElement(selectDocument(state), elementId);
  if (photoAssetId(current) === sourceId) {
    state.change((doc) =>
      updateElement(doc, elementId, { assetId: result.id })
    );
  }
};
