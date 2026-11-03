import type { Size } from "@/lib/document/geometry";

// The mock layouts the YouTube preview draws a thumbnail into. Widths are in
// CSS pixels, at the size YouTube shows thumbnails on a laptop (a window
// about 1440px wide) and on a 390px-wide phone. They drift whenever YouTube
// changes its layout, so they all live here.
// Search, Up next and the phone feed were measured on the site, signed out,
// on 2026-11-03. Signed out, the home page shows no videos, so the home
// grid's 360 is the width of a three- or four-column grid at that window
// size, not a measurement.
export const LAYOUTS = [
  {
    // Two columns of the home grid, with its gaps and side padding
    frameWidth: 784,
    id: "home",
    label: "Home",
    slots: 4,
    thumbnailWidth: 360,
  },
  {
    // A results row: the thumbnail and the start of the text beside it
    frameWidth: 864,
    id: "search",
    label: "Search",
    slots: 4,
    thumbnailWidth: 500,
  },
  {
    // The column beside the player on a video's page
    frameWidth: 500,
    id: "up-next",
    label: "Up next",
    slots: 5,
    thumbnailWidth: 288,
  },
  {
    // A phone's feed, edge to edge
    frameWidth: 390,
    id: "mobile",
    label: "Mobile",
    slots: 3,
    thumbnailWidth: 390,
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

// How far a frame `frame` pixels wide shrinks to fit `available` pixels:
// never grown, and 1 until there's a width to fit (rounded down, so it
// always fits)
export const fitScale = (frame: number, available: number): number => {
  if (!(frame > 0 && available > 0) || available >= frame) {
    return 1;
  }
  return Math.floor((available / frame) * 100) / 100;
};

// A feed of `slots` videos: the design first, the thumbnails it's compared
// with spread through the rest in the order they were added, and made-up
// videos filling the gaps. Anything already in the feed isn't repeated, and
// when the fillers run out the feed is shorter. With no fillers, it's just
// the design and its compares side by side.
export const arrangeFeed = <Item extends { id: string }>(
  current: Item,
  compares: readonly Item[],
  fillers: readonly Item[],
  slots: number
): Item[] => {
  const seen = new Set([current.id]);
  const fresh = (item: Item) => {
    if (seen.has(item.id)) {
      return false;
    }
    seen.add(item.id);
    return true;
  };
  const yours = compares.filter(fresh);
  const others = fillers.filter(fresh);
  // Every compare gets a slot, however few the layout has
  const rest = Math.max(slots, yours.length + 1) - 1;
  const comparesAt = new Set(
    yours.map((_, index) =>
      Math.ceil(((index + 1) * (rest + 1)) / (yours.length + 1))
    )
  );
  const feed = [current];
  let compareIndex = 0;
  let fillerIndex = 0;
  for (let slot = 1; slot <= rest; slot += 1) {
    if (comparesAt.has(slot)) {
      feed.push(...yours.slice(compareIndex, compareIndex + 1));
      compareIndex += 1;
    } else {
      feed.push(...others.slice(fillerIndex, fillerIndex + 1));
      fillerIndex += 1;
    }
  }
  return feed;
};
