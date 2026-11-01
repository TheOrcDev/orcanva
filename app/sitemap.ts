import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/site";
import { SPONSORS_PATH } from "@/lib/sponsors";

// Every page meant to be found in search: the landing and the pages beside
// it. The studio, the editor and sign-in are the app itself (noindex).
const PATHS = ["/", SPONSORS_PATH];

const sitemap = (): MetadataRoute.Sitemap =>
  PATHS.map((path) => ({ url: new URL(path, SITE_URL).href }));

export default sitemap;
