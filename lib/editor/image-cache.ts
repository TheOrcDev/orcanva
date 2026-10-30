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

// Looks up assets the editor hasn't seen yet (set by useAssetResolver)
let resolveAssets: ((ids: string[]) => Promise<void>) | null = null;

export const setAssetResolver = (
  resolver: ((ids: string[]) => Promise<void>) | null
) => {
  resolveAssets = resolver;
};

const waitForImages = async (document: DesignDocument): Promise<void> => {
  const ids = document.elements.flatMap((element) =>
    element.type === "image" && element.visible ? [element.assetId] : []
  );
  // A collaborator's fresh upload: find its URL before drawing
  const unknown = ids.filter((id) => !assetUrls.has(id));
  if (unknown.length > 0 && resolveAssets) {
    await resolveAssets(unknown);
  }
  const urls = ids.flatMap((id) => assetUrls.get(id) ?? []);
  await Promise.allSettled(urls.map(loadImage));
};

registerRenderPreparer(waitForImages);
