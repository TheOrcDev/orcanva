import type { Size } from "@/lib/document/geometry";

// Filtered pixels for twice the element's page size cover retina screens
// and the 2x export; more would only cost memory
export const FILTER_SUPERSAMPLE = 2;
export const MAX_FILTER_SIDE = 4096;

export const filterOutputSize = (
  natural: Size,
  box: Size,
  maxSide = MAX_FILTER_SIDE
): Size => {
  const scale = Math.min(
    1,
    FILTER_SUPERSAMPLE *
      Math.max(box.width / natural.width, box.height / natural.height),
    maxSide / Math.max(natural.width, natural.height)
  );
  return {
    height: Math.max(1, Math.round(natural.height * scale)),
    width: Math.max(1, Math.round(natural.width * scale)),
  };
};
