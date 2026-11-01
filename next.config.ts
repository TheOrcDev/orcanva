import type { NextConfig } from "next";

import { SITE_URL } from "./lib/site";

// Production also answers on its Vercel address, which search engines would
// count as a copy of the site. Its pages move to www for good; the API stays,
// so tabs still open there keep saving until they're reloaded.
const VERCEL_HOST = "orcanva.vercel.app";

const nextConfig: NextConfig = {
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
