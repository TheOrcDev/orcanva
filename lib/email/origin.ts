import "server-only";
import { headers } from "next/headers";

import { SITE_URL } from "@/lib/site";

// Where links in emails point. Production always links to its own address,
// whatever host a request claims; dev links back to the local server. Read
// it during the request: after() callbacks in pages can't call headers().
export const appOrigin = async (): Promise<string> => {
  if (process.env.NODE_ENV === "production") {
    return SITE_URL;
  }
  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "localhost:3000";
  return `http://${host}`;
};
