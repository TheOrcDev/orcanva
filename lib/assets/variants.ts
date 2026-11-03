// What a derived image is to the asset it was made from (assets.variant).
// Safe in client code: the database enum and the upload input both read it.
export const ASSET_VARIANTS = [
  "no-background",
  "erased",
  "upscaled-2x",
  "upscaled-4x",
] as const;

export type AssetVariant = (typeof ASSET_VARIANTS)[number];

// The same source always gives the same cutout or upscale, so those are
// stored once and looked up by source. An erase depends on its mask, so it's
// never looked up that way, and one photo can have any number of them.
export const isReusableVariant = (variant: AssetVariant): boolean =>
  variant !== "erased";
