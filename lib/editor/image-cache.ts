import type { DesignDocument } from "@/lib/document/schema";
import type { EditorAsset } from "@/lib/editor/store";
import { registerRenderPreparer } from "@/lib/export/prepare";

// Shared HTMLImageElement per URL. Images come from our same-origin storage
// proxy, so the canvas is never tainted and exports always work.
const cache = new Map<string, Promise<HTMLImageElement>>();
const loaded = new Map<string, HTMLImageElement>();

export const loadImage = (url: string): Promise<HTMLImageElement> => {
  let pending = cache.get(url);
  if (!pending) {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    pending = image.decode().then(() => {
      loaded.set(url, image);
      return image;
    });
    // Let a failed URL be retried later
    pending.catch(() => cache.delete(url));
    cache.set(url, pending);
  }
  return pending;
};

export const getLoadedImage = (url: string): HTMLImageElement | undefined =>
  loaded.get(url);

// assetId → URL for the open editor; exports wait on these images
const assetUrls = new Map<string, string>();

export const setAssetUrls = (assets: readonly EditorAsset[]) => {
  assetUrls.clear();
  for (const asset of assets) {
    assetUrls.set(asset.id, asset.url);
  }
};

const waitForImages = async (document: DesignDocument): Promise<void> => {
  const urls = document.elements.flatMap((element) => {
    if (element.type !== "image" || !element.visible) {
      return [];
    }
    const url = assetUrls.get(element.assetId);
    return url ? [url] : [];
  });
  await Promise.allSettled(urls.map(loadImage));
};

registerRenderPreparer(waitForImages);
