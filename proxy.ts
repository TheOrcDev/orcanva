import type { NeonAuth } from "@neon/auth/next/server";
import type { NextRequest } from "next/server";

import { getAuth } from "@/lib/auth/server";

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
  middleware ??= getAuth().middleware({ publicRoutes: ["/", "/design"] });
  return await middleware(request);
};

export const config = {
  // Pages only: API routes check sessions themselves, and the proxy would
  // cap request bodies (uploads) at 10 MB
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
