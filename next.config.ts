import type { NextConfig } from "next";

import { SITE_URL } from "./lib/site";

// Production also answers on its Vercel address, which search engines would
// count as a copy of the site. Its pages move to www for good; the API stays,
// so tabs still open there keep saving until they're reloaded.
const VERCEL_HOST = "orcanva.vercel.app";

// The graphics catalog sits under a content hash (pnpm graphics:build), so
// browsers may keep it for good; public files are otherwise revalidated
const GRAPHICS_CACHE = "public, max-age=31536000, immutable";

const nextConfig: NextConfig = {
  headers: () => [
    {
      headers: [{ key: "Cache-Control", value: GRAPHICS_CACHE }],
      source: "/graphics/:path*",
    },
  ],
  redirects: () => [
    {
      destination: `${SITE_URL}/:path*`,
      has: [{ type: "host", value: VERCEL_HOST }],
      permanent: true,
      source: "/:path((?!api/).*)",
    },
  ],
};

export default nextConfig;
