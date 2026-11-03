import type { AssetVariant } from "@/lib/assets/variants";
import type { EditorAsset } from "@/lib/editor/store";

// The assets an image was made from, starting with `id` itself: a cutout,
// then the upscale it was cut from, then the upload. Stops at the first id
// this editor hasn't loaded (it's still listed) and at a loop, which the
// database can't hold but a stale editor shouldn't hang on.
export const assetChain = (
  assets: readonly EditorAsset[],
  id: string
): string[] => {
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  const chain = [id];
  let source = byId.get(id)?.sourceAssetId ?? null;
  while (source !== null && !chain.includes(source)) {
    chain.push(source);
    source = byId.get(source)?.sourceAssetId ?? null;
  }
  return chain;
};

// The upload every derived copy of `id` goes back to ("Restore original")
export const originalAssetId = (
  assets: readonly EditorAsset[],
  id: string
): string => assetChain(assets, id).at(-1) ?? id;

// Whether `id` or anything it was made from is that kind of copy, e.g. a
// cutout that was upscaled afterwards still has no background
export const hasVariant = (
  assets: readonly EditorAsset[],
  id: string,
  variant: AssetVariant
): boolean => {
  const byId = new Map(assets.map((asset) => [asset.id, asset]));
  return assetChain(assets, id).some(
    (link) => byId.get(link)?.variant === variant
  );
};

// A stored result of `variant` made straight from `sourceId`, if this editor
// knows one. Erases are never looked up (see isReusableVariant).
export const findVariant = (
  assets: readonly EditorAsset[],
  sourceId: string,
  variant: AssetVariant
): EditorAsset | undefined =>
  assets.find(
    (asset) => asset.sourceAssetId === sourceId && asset.variant === variant
  );
