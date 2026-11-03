// What a derived image is to the asset it was made from (assets.variant).
// Safe in client code: the database enum and the upload input both read it.
// The order is the enum's sort order, which the database relies on: kinds
// that are never reused (see below) sort before "no-background", and the
// rest after it (assets_owner_source_variant_idx in lib/db/schema.ts).
export const ASSET_VARIANTS = [
  "erased",
  "no-background",
  "upscaled-2x",
  "upscaled-4x",
] as const;

export type AssetVariant = (typeof ASSET_VARIANTS)[number];

// The same source always gives the same cutout or upscale, so those are
// stored once and looked up by source. An erase depends on its mask, so it's
// never looked up that way, and one photo can have any number of them.
export const isReusableVariant = (variant: AssetVariant): boolean =>
  variant !== "erased";
