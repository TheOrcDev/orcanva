import type { PreviewTheme } from "@/lib/youtube-preview/details";

// Plain greys for the mock's light and dark looks. The mock sets them as CSS
// variables on its frame (`--yt-bg`, …) and draws with `bg-(--yt-bg)`.
// They're generic on purpose: the mock borrows a video site's proportions,
// not its brand.
export interface PreviewThemeTokens {
  // The picked topic chip and its text
  active: string;
  activeText: string;
  // Behind initials when a channel has no picture
  avatar: string;
  bg: string;
  // Where a logo would be
  block: string;
  border: string;
  muted: string;
  // Chips, the search button, the phone's frame
  surface: string;
  text: string;
}

export const PREVIEW_THEME_TOKENS: Record<PreviewTheme, PreviewThemeTokens> = {
  dark: {
    active: "#f1f1f1",
    activeText: "#0f0f0f",
    avatar: "#5f6b7a",
    bg: "#0f0f0f",
    block: "#3d3d3d",
    border: "#303030",
    muted: "#aaaaaa",
    surface: "#272727",
    text: "#f1f1f1",
  },
  light: {
    active: "#0f0f0f",
    activeText: "#ffffff",
    avatar: "#7b8794",
    bg: "#ffffff",
    block: "#e5e5e5",
    border: "#d3d3d3",
    muted: "#606060",
    surface: "#f2f2f2",
    text: "#0f0f0f",
  },
};

// The same in both looks: initials on avatars, black bars around pictures
// that aren't 16:9, and the length badge over the bottom-right corner
export const PREVIEW_FIXED_TOKENS = {
  avatarText: "#ffffff",
  badge: "rgb(0 0 0 / 0.8)",
  badgeText: "#ffffff",
  letterbox: "#000000",
} as const;
