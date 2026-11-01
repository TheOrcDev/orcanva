import type { MetadataRoute } from "next";

import { NEW_DESIGN_PATH } from "@/lib/routes";
import { SITE_URL } from "@/lib/site";

// Crawlers may read every page; the app's own pages keep themselves out of
// the index with noindex, which they can only see if they're crawlable. The
// API has nothing to read, and /new makes designs (or asks to sign in).
const robots = (): MetadataRoute.Robots => ({
  rules: {
    allow: "/",
    disallow: ["/api/", `${NEW_DESIGN_PATH}/`],
    userAgent: "*",
  },
  sitemap: `${SITE_URL}/sitemap.xml`,
});

export default robots;
