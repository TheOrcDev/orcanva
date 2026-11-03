import { z } from "zod";

import { normalizeHex } from "@/lib/document/color";

// Colours this browser picked lately, newest first, for the colour
// picker's "Recent" row. Per browser, not per account.
export const RECENT_COLORS_KEY = "orcanva:recent-colors";
export const MAX_RECENT_COLORS = 12;

const storedColors = z.array(z.string());

// Puts a colour first, without repeating it, and keeps the newest few
export const addRecentColor = (
  colors: readonly string[],
  color: string
): string[] => {
  const normal = normalizeHex(color);
  if (!normal) {
    return [...colors];
  }
  return [normal, ...colors.filter((item) => item !== normal)].slice(
    0,
    MAX_RECENT_COLORS
  );
};

// What was stored, cleaned up: anything unreadable is dropped
export const parseRecentColors = (raw: string | null): string[] => {
  if (!raw) {
    return [];
  }
  try {
    const parsed = storedColors.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return [];
    }
    let colors: string[] = [];
    // Oldest first, so each colour ends up where it was
    for (const color of parsed.data.toReversed()) {
      colors = addRecentColor(colors, color);
    }
    return colors;
  } catch {
    return [];
  }
};

// localStorage, when the browser lets us at it
const browserStorage = (): Storage | undefined => {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
};

export const loadRecentColors = (
  storage: Storage | undefined = browserStorage()
): string[] => {
  try {
    return parseRecentColors(storage?.getItem(RECENT_COLORS_KEY) ?? null);
  } catch {
    return [];
  }
};

// Adds a colour to the stored list and returns the new list
export const rememberRecentColor = (
  color: string,
  storage: Storage | undefined = browserStorage()
): string[] => {
  const colors = addRecentColor(loadRecentColors(storage), color);
  try {
    storage?.setItem(RECENT_COLORS_KEY, JSON.stringify(colors));
  } catch {
    // Storage can be full or disabled; the colour just won't be remembered
  }
  return colors;
};
