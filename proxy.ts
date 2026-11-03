import type { NeonAuth } from "@neon/auth/next/server";
import type { NextRequest } from "next/server";

import { getAuth } from "@/lib/auth/server";
import {
  INVITE_PATH,
  NEW_DESIGN_PATH,
  SETTINGS_PATH,
  STUDIO_PATH,
} from "@/lib/routes";

let middleware: ReturnType<NeonAuth["middleware"]> | undefined;

// The routes that read the session, each with everything under it. All of
// them are public as well: guests co-edit public designs, and each page,
// Route Handler and Server Action checks access itself with getViewer().
const SESSION_ROUTES = [
  "/",
  STUDIO_PATH,
  "/design",
  SETTINGS_PATH,
  NEW_DESIGN_PATH,
  INVITE_PATH,
  "/auth",
];

// `/` is only the landing itself, the others include their subpaths
const isSessionRoute = (pathname: string) =>
  SESSION_ROUTES.some(
    (route) =>
      pathname === route || (route !== "/" && pathname.startsWith(`${route}/`))
  );

// Finishes Google sign-ins and keeps session cookies fresh before pages
// render. It protects nothing, and it sends any path it doesn't know to
// sign-in, so everything but the session routes skips it: the landing's
// other pages and their share images, robots.txt and the sitemap reach
// crawlers, and unknown URLs get a real 404.
export const proxy = async (request: NextRequest) => {
  // Server Actions check the session themselves
  if (
    request.headers.has("next-action") ||
    !isSessionRoute(request.nextUrl.pathname)
  ) {
    return;
  }
  middleware ??= getAuth().middleware({ publicRoutes: SESSION_ROUTES });
  return await middleware(request);
};

export const config = {
  // Pages only: API routes check sessions themselves, and the proxy would
  // cap request bodies (uploads) at 10 MB. Static files, icons, share images,
  // the graphics catalog and template files skip it without a call.
  matcher: [
    "/((?!api|_next/static|_next/image|graphics/|template-files/|favicon.ico|icon|apple-icon|opengraph-image).*)",
  ],
};
