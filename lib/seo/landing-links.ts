import {
  BACKGROUND_REMOVER_PATH,
  CANVA_ALTERNATIVE_PATH,
  IMAGE_SIZES_PATH,
  REMOVE_AI_METADATA_PATH,
  REMOVE_BG_ALTERNATIVE_PATH,
  TEMPLATES_PATH,
  YOUTUBE_PREVIEW_PATH,
} from "@/lib/routes";
import { SIZE_PAGES, sizePagePath } from "@/lib/seo/size-pages";

export interface LandingLink {
  href: string;
  label: string;
}

// The landing's pages for what people search for, as the footer lists them
// and the sitemap reads them
export const TOOL_LINKS: readonly LandingLink[] = [
  { href: BACKGROUND_REMOVER_PATH, label: "Background remover" },
  { href: REMOVE_AI_METADATA_PATH, label: "AI metadata remover" },
  { href: YOUTUBE_PREVIEW_PATH, label: "YouTube thumbnail preview" },
  { href: TEMPLATES_PATH, label: "Templates" },
  ...SIZE_PAGES.map((page) => ({ href: sizePagePath(page), label: page.name })),
  { href: IMAGE_SIZES_PATH, label: "Social media image sizes" },
];

export const COMPARE_LINKS: readonly LandingLink[] = [
  { href: CANVA_ALTERNATIVE_PATH, label: "Canva alternative" },
  { href: REMOVE_BG_ALTERNATIVE_PATH, label: "remove.bg alternative" },
];
