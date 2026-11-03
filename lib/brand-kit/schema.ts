import { z } from "zod";

import { normalizeHex } from "@/lib/document/color";
import type { EditorAsset } from "@/lib/editor/store";
import { FONT_CATALOG } from "@/lib/fonts/catalog";

// An account's brand kit: colours, fonts and logos it keeps at hand. Each
// item is one row in brand_kit_items, unique per account, kind and value.
export const BRAND_KIT_KINDS = ["color", "font", "logo"] as const;
export type BrandKitKind = (typeof BRAND_KIT_KINDS)[number];

export const BRAND_KIT_LIMITS = {
  color: 24,
  font: 10,
  logo: 12,
} as const satisfies Record<BrandKitKind, number>;

const FONT_IDS: ReadonlySet<string> = new Set(
  FONT_CATALOG.map((font) => font.id)
);

// Stored lowercase, one spelling per colour
export const brandColor = z.string().transform((color, context) => {
  const normal = normalizeHex(color);
  if (!normal) {
    context.addIssue({ code: "custom", message: "Not a hex color" });
    return z.NEVER;
  }
  return normal;
});

// A catalog font. getFont falls back to the default for anything else, so
// it can't tell.
export const brandFont = z
  .string()
  .refine((id) => FONT_IDS.has(id), { message: "Not a catalog font" });

// The upload a logo shows
export const brandLogo = z.uuid();

export const brandKitItem = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("color"), value: brandColor }),
  z.object({ kind: z.literal("font"), value: brandFont }),
  z.object({ kind: z.literal("logo"), value: brandLogo }),
]);
export type BrandKitItem = z.output<typeof brandKitItem>;

// As the editor and Settings hold it, oldest first in each list
export interface BrandKit {
  // Lowercase hex
  colors: string[];
  // Catalog font ids
  fonts: string[];
  logos: EditorAsset[];
}

export const EMPTY_BRAND_KIT: BrandKit = { colors: [], fonts: [], logos: [] };

// A stored row; `logo` is its upload, when that's still there and ready
export interface StoredBrandKitItem {
  kind: BrandKitKind;
  value: string;
  logo: EditorAsset | null;
}

// Rows, oldest first, to a kit. Leaves out what no longer reads: a colour
// or font this code doesn't know, or a logo whose upload is gone.
export const kitFromItems = (
  items: readonly StoredBrandKitItem[]
): BrandKit => {
  const colors = new Set<string>();
  const fonts = new Set<string>();
  const logos = new Map<string, EditorAsset>();
  for (const item of items) {
    if (item.kind === "color") {
      const color = brandColor.safeParse(item.value);
      if (color.success && colors.size < BRAND_KIT_LIMITS.color) {
        colors.add(color.data);
      }
    } else if (item.kind === "font") {
      if (FONT_IDS.has(item.value) && fonts.size < BRAND_KIT_LIMITS.font) {
        fonts.add(item.value);
      }
    } else if (item.logo && logos.size < BRAND_KIT_LIMITS.logo) {
      logos.set(item.logo.id, item.logo);
    }
  }
  return { colors: [...colors], fonts: [...fonts], logos: [...logos.values()] };
};

export const hasBrandItem = (kit: BrandKit, item: BrandKitItem): boolean => {
  switch (item.kind) {
    case "color": {
      return kit.colors.includes(item.value);
    }
    case "font": {
      return kit.fonts.includes(item.value);
    }
    default: {
      return kit.logos.some((logo) => logo.id === item.value);
    }
  }
};

export const brandItemCount = (kit: BrandKit, kind: BrandKitKind): number => {
  switch (kind) {
    case "color": {
      return kit.colors.length;
    }
    case "font": {
      return kit.fonts.length;
    }
    default: {
      return kit.logos.length;
    }
  }
};

export const isBrandKitFull = (kit: BrandKit, kind: BrandKitKind): boolean =>
  brandItemCount(kit, kind) >= BRAND_KIT_LIMITS[kind];

const PLURALS: Record<BrandKitKind, string> = {
  color: "colors",
  font: "fonts",
  logo: "logos",
};

// Why an add left the kit without the item, or null when it's there
export const addRefusal = (
  kit: BrandKit,
  item: BrandKitItem
): string | null => {
  if (hasBrandItem(kit, item)) {
    return null;
  }
  if (isBrandKitFull(kit, item.kind)) {
    return `Your brand kit holds up to ${BRAND_KIT_LIMITS[item.kind]} ${PLURALS[item.kind]}`;
  }
  // Only logos can be refused for anything else
  return "That image isn't in your uploads";
};
