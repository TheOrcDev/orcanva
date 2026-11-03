import { z } from "zod";

// What the YouTube preview shows around a thumbnail: the video's title, the
// channel and the length on its badge. None of it is part of the design or
// reaches the server: it's kept per browser, like the collaboration profile
// (lib/collab/identity.ts), and anything unreadable falls back to defaults.
export const PREVIEW_DETAILS_KEY = "orcanva:youtube-preview";
// Titles are per design, by design id
export const PREVIEW_TITLES_KEY = "orcanva:youtube-preview:titles";

// YouTube's own limit for a video title
export const MAX_TITLE = 100;
export const MAX_CHANNEL = 60;
// An 88px JPEG as a data URL takes a few kilobytes
export const MAX_AVATAR = 100_000;
export const DEFAULT_DURATION = "12:34";
// The newest titles kept; older ones are forgotten
export const MAX_SAVED_TITLES = 50;
// The badge stops at 99:59:59
const MAX_SECONDS = 99 * 3600 + 59 * 60 + 59;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

// A length as the badge shows it: m:ss, or h:mm:ss from an hour on
const DURATION = /^(?:[1-9]\d?:[0-5]\d|[1-5]?\d):[0-5]\d$/u;
// What people type: minutes alone, m:ss or h:mm:ss
const DURATION_INPUT =
  /^(?<first>\d+)(?::(?<second>\d{2}))?(?::(?<third>\d{2}))?$/u;

export const PREVIEW_THEMES = ["light", "dark"] as const;
export type PreviewTheme = (typeof PREVIEW_THEMES)[number];

export const previewDetailsSchema = z.object({
  avatar: z
    .string()
    .max(MAX_AVATAR)
    .startsWith("data:image/")
    .nullable()
    .catch(null),
  channel: z.string().trim().max(MAX_CHANNEL).catch(""),
  duration: z.string().regex(DURATION).catch(DEFAULT_DURATION),
  theme: z.enum(PREVIEW_THEMES).catch("light"),
});

export type PreviewDetails = z.infer<typeof previewDetailsSchema>;

export const DEFAULT_DETAILS: PreviewDetails = previewDetailsSchema.parse({});

const twoDigits = (value: number) => String(value).padStart(2, "0");

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((seconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const rest = twoDigits(seconds % SECONDS_PER_MINUTE);
  return hours > 0
    ? `${hours}:${twoDigits(minutes)}:${rest}`
    : `${minutes}:${rest}`;
};

// A typed length the way the badge writes it ("05:07" → "5:07", "75:00" →
// "1:15:00", "8" → "8:00"), or null when it isn't one
export const normalizeDuration = (input: string): string | null => {
  const groups = DURATION_INPUT.exec(input.trim())?.groups;
  if (!groups) {
    return null;
  }
  const parts = [groups.first, groups.second, groups.third]
    .filter((part) => part !== undefined)
    .map(Number);
  // Minutes alone, so "8" is an eight-minute video
  if (parts.length === 1) {
    parts.push(0);
  }
  // Only the first part may run past 59
  if (parts.slice(1).some((part) => part >= SECONDS_PER_MINUTE)) {
    return null;
  }
  const seconds = parts.reduce(
    (total, part) => total * SECONDS_PER_MINUTE + part,
    0
  );
  return seconds <= MAX_SECONDS ? formatDuration(seconds) : null;
};

const isHighSurrogate = (code: number) => code >= 0xd8_00 && code <= 0xdb_ff;

// A title cut to YouTube's limit, without splitting an emoji in two
export const clampTitle = (title: string): string => {
  if (title.length <= MAX_TITLE) {
    return title;
  }
  const cut = title.slice(0, MAX_TITLE);
  return isHighSurrogate(cut.codePointAt(cut.length - 1) ?? 0)
    ? cut.slice(0, -1)
    : cut;
};

// Titles by design id, oldest first
export type PreviewTitles = Record<string, string>;

const storedTitles = z.record(z.string(), z.unknown());
const designId = z.uuid();
const savedTitle = z.string().max(MAX_TITLE);

// localStorage, when the browser lets us at it
export const browserStorage = (): Storage | undefined => {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
};

const readJson = (storage: Storage | undefined, key: string): unknown => {
  try {
    const raw = storage?.getItem(key);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
};

const writeJson = (
  storage: Storage | undefined,
  key: string,
  value: unknown
) => {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be full or disabled; the settings just won't persist
  }
};

// Each field that doesn't read falls back to its default on its own
export const parseDetails = (value: unknown): PreviewDetails => {
  const parsed = previewDetailsSchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_DETAILS;
};

export const loadDetails = (
  storage: Storage | undefined = browserStorage()
): PreviewDetails => parseDetails(readJson(storage, PREVIEW_DETAILS_KEY));

export const saveDetails = (
  details: PreviewDetails,
  storage: Storage | undefined = browserStorage()
): void => writeJson(storage, PREVIEW_DETAILS_KEY, details);

// The readable entries, the newest few
export const parseTitles = (value: unknown): PreviewTitles => {
  const parsed = storedTitles.safeParse(value);
  if (!parsed.success) {
    return {};
  }
  const entries = Object.entries(parsed.data).flatMap(([id, title]) => {
    const read = savedTitle.safeParse(title);
    return designId.safeParse(id).success && read.success
      ? [[id, read.data] as const]
      : [];
  });
  return Object.fromEntries(entries.slice(-MAX_SAVED_TITLES));
};

// Moves the design's title to the newest end; an empty one is forgotten,
// so the design's name shows again
export const withTitle = (
  titles: PreviewTitles,
  id: string,
  title: string
): PreviewTitles => {
  const others = Object.entries(titles).filter(([key]) => key !== id);
  const entries = title ? [...others, [id, clampTitle(title)]] : others;
  return Object.fromEntries(entries.slice(-MAX_SAVED_TITLES));
};

export const loadTitle = (
  id: string,
  storage: Storage | undefined = browserStorage()
): string => parseTitles(readJson(storage, PREVIEW_TITLES_KEY))[id] ?? "";

export const saveTitle = (
  id: string,
  title: string,
  storage: Storage | undefined = browserStorage()
): void => {
  const titles = parseTitles(readJson(storage, PREVIEW_TITLES_KEY));
  writeJson(storage, PREVIEW_TITLES_KEY, withTitle(titles, id, title));
};
