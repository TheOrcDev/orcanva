import {
  FONT_CATALOG,
  FONT_CATEGORY_LABELS,
  findFont,
} from "@/lib/fonts/catalog";
import type { FontCategory, FontDefinition } from "@/lib/fonts/catalog";

// The font picker's groups, in order
export interface FontGroup {
  value: string;
  items: FontDefinition[];
}

export const BRAND_FONTS_LABEL = "Brand fonts";

const CATEGORY_ORDER: FontCategory[] = [
  "display",
  "sans",
  "serif",
  "mono",
  "script",
];

const CATEGORY_GROUPS: FontGroup[] = CATEGORY_ORDER.map((category) => ({
  items: FONT_CATALOG.filter((font) => font.category === category),
  value: FONT_CATEGORY_LABELS[category],
}));

// Every catalog font by category, with the brand kit's fonts on top. A brand
// font stays in its category too, as the same object, so it shows as
// chosen in both places.
export const fontGroups = (brandIds: readonly string[] = []): FontGroup[] => {
  const brand = [...new Set(brandIds)].flatMap((id) => findFont(id) ?? []);
  return brand.length > 0
    ? [{ items: brand, value: BRAND_FONTS_LABEL }, ...CATEGORY_GROUPS]
    : CATEGORY_GROUPS;
};
