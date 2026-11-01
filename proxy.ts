import type { NeonAuth } from "@neon/auth/next/server";
import type { NextRequest } from "next/server";

import { getAuth } from "@/lib/auth/server";
import { SETTINGS_PATH, STUDIO_PATH } from "@/lib/routes";

let middleware: ReturnType<NeonAuth["middleware"]> | undefined;

// Finishes Google sign-ins and keeps session cookies fresh before pages
// render. It protects nothing: every page is public (guests co-edit public
// designs), and each page, Route Handler and Server Action checks access
// itself with getViewer().
export const proxy = async (request: NextRequest) => {
  // Server Actions check the session themselves
  if (request.headers.has("next-action")) {
    return;
  }
  middleware ??= getAuth().middleware({
    publicRoutes: ["/", STUDIO_PATH, "/design", SETTINGS_PATH],
  });
  return await middleware(request);
};

export const config = {
  // Pages only: API routes check sessions themselves, and the proxy would
  // cap request bodies (uploads) at 10 MB. Share images live at
  // /opengraph-image-<hash> and app icons at /icon.svg and /apple-icon.png,
  // which no public route covers, so crawlers and signed-out tabs would
  // otherwise be sent to sign-in.
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|opengraph-image).*)",
  ],
};
