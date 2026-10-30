const ORIGIN = "https://orcanva.invalid";

// Where to go after signing in: only a path on this site, so a crafted
// ?next= can't send people somewhere else
export const safeNext = (
  next: string | null | undefined,
  fallback = "/"
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

// The sign-in page, coming back to `path` afterwards
export const signInUrl = (path: string): string =>
  path === "/"
    ? "/auth/sign-in"
    : `/auth/sign-in?next=${encodeURIComponent(path)}`;
