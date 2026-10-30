import "server-only";
import { createNeonAuth } from "@neon/auth/next/server";
import type { NeonAuth } from "@neon/auth/next/server";
import { NEON_AUTH_SESSION_COOKIE_NAME } from "@neon/auth/server";
import { cookies } from "next/headers";
import { cache } from "react";

import { getEnv } from "@/lib/env";

let instance: NeonAuth | undefined;

// Lazy: createNeonAuth checks the cookie secret when it's constructed, and
// `next build` imports modules without the runtime env
export const getAuth = (): NeonAuth => {
  if (!instance) {
    const env = getEnv();
    instance = createNeonAuth({
      baseUrl: env.NEON_AUTH_BASE_URL,
      cookies: { secret: env.NEON_AUTH_COOKIE_SECRET },
    });
  }
  return instance;
};

// The signed-in person, as the rest of the app sees them
export interface Viewer {
  id: string;
  name: string;
  email: string;
  image: string | null;
}

const SIGNED_OUT_STATUSES = new Set([401, 403]);

// Who is making this request, or null for a guest. Call it in every page,
// Route Handler and Server Action that touches data: proxy.ts only keeps
// cookies fresh, it isn't the security boundary.
export const getViewer = cache(async (): Promise<Viewer | null> => {
  // Guests have no session cookie: skip the round trip to the auth server
  // (presence alone sends about ten requests a second)
  const store = await cookies();
  if (!store.has(NEON_AUTH_SESSION_COOKIE_NAME)) {
    return null;
  }

  const { data, error } = await getAuth().getSession();
  if (error) {
    if (error.status !== undefined && SIGNED_OUT_STATUSES.has(error.status)) {
      return null;
    }
    // Don't quietly downgrade an owner to a guest while auth is unreachable
    throw new Error(`Couldn't check the session: ${error.message}`);
  }
  const user = data?.user;
  if (!user) {
    return null;
  }
  return {
    email: user.email,
    id: user.id,
    image: user.image ?? null,
    name: user.name,
  };
});
