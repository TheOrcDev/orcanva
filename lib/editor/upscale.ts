import { runAiTask } from "@/lib/ai/client";
import type { AiProgress } from "@/lib/ai/client";
import { findVariant } from "@/lib/editor/asset-variants";
import {
  fetchAssetImage,
  saveDerivedImage,
  sourcePhoto,
  swapPhoto,
} from "@/lib/editor/derived-images";
import type { EditorAsset, EditorStoreApi } from "@/lib/editor/store";
import { factorLabel } from "@/lib/upscale/options";
import type { UpscaleOption } from "@/lib/upscale/options";

const createUpscale = async (
  store: EditorStoreApi,
  source: EditorAsset,
  { factor, height, variant, width }: UpscaleOption,
  onProgress?: (progress: AiProgress) => void
): Promise<EditorAsset> => {
  const image = await fetchAssetImage(source);
  const { blob } = await runAiTask(
    { height, image, kind: "upscale", width },
    onProgress
  );
  return saveDerivedImage(
    store,
    blob,
    source,
    variant,
    ` (${factorLabel(factor)})`
  );
};

// Swaps an image's photo for an upscaled copy (one undo step). The element
// keeps its size and crop, which are fractions, so it just gets sharper.
// The copy is stored like a cutout, so doing it again is instant.
export const upscaleImage = async (
  store: EditorStoreApi,
  elementId: string,
  option: UpscaleOption,
  onProgress?: (progress: AiProgress) => void
): Promise<EditorAsset> => {
  const source = sourcePhoto(store, elementId);
  store.getState().setImageJob(elementId, "upscale");
  try {
    const upscaled =
      findVariant(store.getState().assets, source.id, option.variant) ??
      (await createUpscale(store, source, option, onProgress));
    swapPhoto(store, elementId, source.id, upscaled);
    return upscaled;
  } finally {
    store.getState().setImageJob(elementId, null);
  }
};
