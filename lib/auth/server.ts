import "server-only";
import { createNeonAuth } from "@neon/auth/next/server";
import type { NeonAuth } from "@neon/auth/next/server";
import {
  NEON_AUTH_SESSION_COOKIE_NAME,
  NEON_AUTH_SESSION_DATA_COOKIE_NAME,
} from "@neon/auth/server";
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

  // Neon Auth reads its cached copy of the session from the raw Cookie
  // header, which still carries it while a Server Action re-renders the page
  // after forgetCachedSession. cookies() knows it's gone: then ask the auth
  // server. Without a cached copy it would anyway, so this costs nothing.
  const isCached = Boolean(
    store.get(NEON_AUTH_SESSION_DATA_COOKIE_NAME)?.value
  );
  const { data, error } = await getAuth().getSession(
    isCached ? undefined : { query: { disableCookieCache: "true" } }
  );
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

// Neon Auth keeps a signed copy of the session, user included, in a cookie
// for five minutes. After changing someone's name or picture, drop it so the
// next request reads the account fresh instead of showing the old one.
// Server Actions and Route Handlers only: pages can't set cookies.
export const forgetCachedSession = async (): Promise<void> => {
  const store = await cookies();
  // Deleting a __Secure- cookie needs the Secure flag too
  store.set(NEON_AUTH_SESSION_DATA_COOKIE_NAME, "", {
    httpOnly: true,
    maxAge: 0,
    path: "/",
    sameSite: "lax",
    secure: true,
  });
};
