import type { Size } from "@/lib/document/geometry";

// The mock layouts the YouTube preview draws a thumbnail into. Widths are in
// CSS pixels, at the size YouTube shows thumbnails on a laptop (a window
// about 1440px wide). They're approximate and
// drift whenever YouTube changes its layout, so they all live here.
// Last checked: 2026-11-03.
export const LAYOUTS = [
  {
    // Two columns of the home grid, with its gaps and side padding
    frameWidth: 784,
    id: "home",
    label: "Home",
    slots: 4,
    thumbnailWidth: 360,
  },
] as const;

export type PreviewLayout = (typeof LAYOUTS)[number];
export type LayoutId = PreviewLayout["id"];

export const DEFAULT_LAYOUT: LayoutId = "home";

export const findLayout = (id: LayoutId): PreviewLayout =>
  LAYOUTS.find((layout) => layout.id === id) ?? LAYOUTS[0];

export const THUMBNAIL_RATIO = 16 / 9;
// Close enough to fill the frame: 1366×768 is 0.05% off
const RATIO_TOLERANCE = 0.01;

// Where a picture sits in the 16:9 thumbnail frame, in fractions of the
// frame's width and height. Anything else is letterboxed, with black bars
// above and below a wider picture, or beside a taller one.
export interface ThumbnailFit {
  exact: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export const thumbnailFit = ({ width, height }: Size): ThumbnailFit => {
  const ratio = width / height;
  if (Math.abs(ratio / THUMBNAIL_RATIO - 1) <= RATIO_TOLERANCE) {
    return { exact: true, height: 1, width: 1, x: 0, y: 0 };
  }
  if (ratio > THUMBNAIL_RATIO) {
    const share = THUMBNAIL_RATIO / ratio;
    return { exact: false, height: share, width: 1, x: 0, y: (1 - share) / 2 };
  }
  const share = ratio / THUMBNAIL_RATIO;
  return { exact: false, height: 1, width: share, x: (1 - share) / 2, y: 0 };
};
