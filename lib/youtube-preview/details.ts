import { z } from "zod";

// What the YouTube preview shows around a thumbnail: the video's title, the
// channel and the length on its badge. None of it is part of the design or
// reaches the server.

// YouTube's own limit for a video title
export const MAX_TITLE = 100;
export const MAX_CHANNEL = 60;
// An 88px JPEG as a data URL takes a few kilobytes
export const MAX_AVATAR = 100_000;
export const DEFAULT_DURATION = "12:34";
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
