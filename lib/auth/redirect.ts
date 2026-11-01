import { STUDIO_PATH } from "@/lib/routes";

const ORIGIN = "https://orcanva.invalid";

// Where to go after signing in: only a path on this site, so a crafted
// ?next= can't send people somewhere else
export const safeNext = (
  next: string | null | undefined,
  fallback = STUDIO_PATH
): string => {
  if (!next?.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }
  try {
    const url = new URL(next, ORIGIN);
    if (url.origin !== ORIGIN) {
      return fallback;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
};

// An auth page coming back to `path` afterwards, its form filled in with
// `email` when there's one (e.g. the address a design was shared with)
const authUrl = (page: string, path: string, email?: string): string => {
  const params = [
    path === STUDIO_PATH ? null : `next=${encodeURIComponent(path)}`,
    email ? `email=${encodeURIComponent(email)}` : null,
  ].filter((param) => param !== null);
  return params.length > 0 ? `${page}?${params.join("&")}` : page;
};

// The sign-in page, coming back to `path` afterwards
export const signInUrl = (path: string, email?: string): string =>
  authUrl("/auth/sign-in", path, email);

// The sign-up page, for people new to Orcanva, likewise
export const signUpUrl = (path: string, email?: string): string =>
  authUrl("/auth/sign-up", path, email);
