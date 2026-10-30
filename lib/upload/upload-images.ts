import { confirmUpload, createUpload } from "@/lib/actions/assets";
import type { CreateUploadSource } from "@/lib/actions/assets";
import { createImageElement } from "@/lib/document/factories";
import type { Point } from "@/lib/document/geometry";
import { insertElement } from "@/lib/editor/document-ops";
import type { EditorAsset, EditorStoreApi } from "@/lib/editor/store";
import { selectDocument } from "@/lib/editor/store";
import { UploadError, prepareImage } from "@/lib/upload/prepare-image";
import type { PreparedImage } from "@/lib/upload/prepare-image";

// Multiple dropped files fan out so they don't stack exactly on top
const STACK_OFFSET = 24;

const putDirect = async (url: string, image: PreparedImage) => {
  const response = await fetch(url, {
    body: image.blob,
    headers: { "Content-Type": image.mimeType },
    method: "PUT",
  });
  if (!response.ok) {
    throw new Error(`Storage responded ${response.status}`);
  }
};

const putViaApp = async (assetId: string, image: PreparedImage) => {
  const response = await fetch(`/api/assets/${assetId}/file`, {
    body: image.blob,
    headers: { "Content-Type": image.mimeType },
    method: "PUT",
  });
  if (!response.ok) {
    throw new Error(`Upload failed with ${response.status}`);
  }
};

// Straight to the bucket when its CORS allows this origin; otherwise
// (e.g. dev server on another port) through the app's own upload route
const putToStorage = async (
  assetId: string,
  url: string,
  image: PreparedImage
) => {
  try {
    await putDirect(url, image);
  } catch {
    await putViaApp(assetId, image);
  }
};

// Reserve (or dedupe) → PUT straight to the bucket → confirm. `source`
// links a derived image (e.g. a cutout) to the asset it was made from.
export const uploadImage = async (
  image: PreparedImage,
  source?: CreateUploadSource
): Promise<EditorAsset> => {
  const result = await createUpload({
    height: image.height,
    mimeType: image.mimeType,
    originalName: image.name,
    sha256: image.sha256,
    size: image.blob.size,
    source,
    width: image.width,
  });
  if (result.status === "exists") {
    return result.asset;
  }
  await putToStorage(result.assetId, result.uploadUrl, image);
  return confirmUpload(result.assetId);
};

export interface UploadFailure {
  file: File;
  message: string;
}

const uploadAndPlace = async (
  store: EditorStoreApi,
  file: File,
  at: Point | undefined
): Promise<UploadFailure | null> => {
  try {
    const prepared = await prepareImage(file);
    const asset = await uploadImage(prepared);
    const state = store.getState();
    state.addAsset(asset);

    const document = selectDocument(state);
    const element = createImageElement(
      { ...asset, name: prepared.name },
      { height: document.height, width: document.width },
      at
    );
    state.change((doc) => insertElement(doc, element));
    state.select([element.id]);
    return null;
  } catch (error) {
    return {
      file,
      message:
        error instanceof UploadError
          ? error.message
          : `Upload failed${error instanceof Error ? `: ${error.message}` : ""}`,
    };
  } finally {
    store.getState().adjustUploads(-1);
  }
};

// Uploads images to the library and places each on the canvas, centered on
// `at` (page coordinates) or the page center. Resolves with any failures.
export const uploadImagesToCanvas = async (
  store: EditorStoreApi,
  files: readonly File[],
  at?: Point
): Promise<UploadFailure[]> => {
  store.getState().adjustUploads(files.length);
  const results = await Promise.all(
    files.map((file, index) =>
      uploadAndPlace(
        store,
        file,
        at && {
          x: at.x + index * STACK_OFFSET,
          y: at.y + index * STACK_OFFSET,
        }
      )
    )
  );
  return results.filter((result): result is UploadFailure => result !== null);
};
