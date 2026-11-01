import { useSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 768;
const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(MOBILE_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

const isMobileViewport = () => window.matchMedia(MOBILE_QUERY).matches;

// Narrower than Tailwind's md breakpoint; false while rendering on the server
export const useIsMobile = (): boolean =>
  useSyncExternalStore(subscribe, isMobileViewport, () => false);
