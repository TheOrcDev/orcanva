import type { MetadataRoute } from "next";

import { COMPARE_LINKS, TOOL_LINKS } from "@/lib/seo/landing-links";
import { SITE_URL } from "@/lib/site";
import { SPONSORS_PATH } from "@/lib/sponsors";

// Every page meant to be found in search: the landing and the pages beside
// it. The studio, the editor and sign-in are the app itself (noindex).
const PATHS = [
  "/",
  ...COMPARE_LINKS.map((link) => link.href),
  ...TOOL_LINKS.map((link) => link.href),
  SPONSORS_PATH,
];

const sitemap = (): MetadataRoute.Sitemap =>
  PATHS.map((path) => ({ url: new URL(path, SITE_URL).href }));

export default sitemap;
