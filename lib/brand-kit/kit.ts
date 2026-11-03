import {
  BRAND_KIT_LIMITS,
  brandItemCount,
  hasBrandItem,
  isBrandKitFull,
} from "@/lib/brand-kit/schema";
import type {
  BrandKit,
  BrandKitItem,
  BrandKitKind,
} from "@/lib/brand-kit/schema";
import { normalizeHex } from "@/lib/document/color";
import type { EditorAsset } from "@/lib/editor/store";
import { findFont } from "@/lib/fonts/catalog";
import type { FontDefinition } from "@/lib/fonts/catalog";

// What the editor and Settings show of a kit, and how it looks the moment
// someone changes it, before the server's answer corrects it

const normalized = (item: BrandKitItem): BrandKitItem =>
  item.kind === "color"
    ? { ...item, value: normalizeHex(item.value) ?? item.value }
    : item;

// The kit with an item added at the end, as the server will add it. A full
// kit, or a logo without its upload, stays as it is.
export const withBrandItem = (
  kit: BrandKit,
  rawItem: BrandKitItem,
  logo?: EditorAsset
): BrandKit => {
  const item = normalized(rawItem);
  if (hasBrandItem(kit, item) || isBrandKitFull(kit, item.kind)) {
    return kit;
  }
  switch (item.kind) {
    case "color": {
      return { ...kit, colors: [...kit.colors, item.value] };
    }
    case "font": {
      return { ...kit, fonts: [...kit.fonts, item.value] };
    }
    default: {
      return logo?.id === item.value
        ? { ...kit, logos: [...kit.logos, logo] }
        : kit;
    }
  }
};

export const withoutBrandItem = (
  kit: BrandKit,
  rawItem: BrandKitItem
): BrandKit => {
  const item = normalized(rawItem);
  if (!hasBrandItem(kit, item)) {
    return kit;
  }
  switch (item.kind) {
    case "color": {
      return { ...kit, colors: kit.colors.filter((c) => c !== item.value) };
    }
    case "font": {
      return { ...kit, fonts: kit.fonts.filter((id) => id !== item.value) };
    }
    default: {
      return {
        ...kit,
        logos: kit.logos.filter((logo) => logo.id !== item.value),
      };
    }
  }
};

// "3 of 24", for the counts by each heading
export const brandCountLabel = (kit: BrandKit, kind: BrandKitKind): string =>
  `${brandItemCount(kit, kind)} of ${BRAND_KIT_LIMITS[kind]}`;

// The kit's fonts as catalog entries, skipping any the catalog dropped
export const brandFonts = (kit: BrandKit): FontDefinition[] =>
  kit.fonts.flatMap((id) => findFont(id) ?? []);

// Uploads that could still become logos, newest first as in the library
export const logoChoices = (
  library: readonly EditorAsset[],
  kit: BrandKit
): EditorAsset[] => {
  const chosen = new Set(kit.logos.map((logo) => logo.id));
  return library.filter((asset) => !chosen.has(asset.id));
};
