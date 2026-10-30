import { z } from "zod";

// How this browser shows up to others on a design. There are no accounts,
// so it's a random orc name and color, kept in localStorage and renamable.
export interface Profile {
  name: string;
  color: string;
}

// Distinct, readable on white and on dark canvases alike
export const PROFILE_COLORS = [
  "#e5484d",
  "#f76b15",
  "#ffc53d",
  "#46a758",
  "#12a594",
  "#0090ff",
  "#6e56cf",
  "#d6409f",
] as const;

const ORC_NAMES = [
  "Grom",
  "Thrall",
  "Durotan",
  "Garrosh",
  "Rexxar",
  "Nazgrel",
  "Drek'Thar",
  "Saurfang",
  "Orgrim",
  "Grommash",
  "Kilrogg",
  "Zuluhed",
];

const ADJECTIVES = [
  "Mighty",
  "Sneaky",
  "Grumpy",
  "Swift",
  "Clever",
  "Loud",
  "Brave",
  "Sleepy",
];

export const PROFILE_KEY = "orcanva:profile";
export const MAX_PROFILE_NAME = 40;

const profileSchema = z.object({
  color: z.string().regex(/^#[0-9a-f]{6}$/iu),
  name: z.string().trim().min(1).max(MAX_PROFILE_NAME),
});

const pick = <T>(items: readonly T[], random: () => number): T =>
  items[Math.floor(random() * items.length)] ?? (items[0] as T);

export const randomProfile = (random: () => number = Math.random): Profile => ({
  color: pick(PROFILE_COLORS, random),
  name: `${pick(ADJECTIVES, random)} ${pick(ORC_NAMES, random)}`,
});

export const parseProfile = (raw: string | null): Profile | null => {
  if (!raw) {
    return null;
  }
  try {
    const parsed = profileSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};

export const saveProfile = (
  storage: Storage | undefined,
  profile: Profile
): void => {
  try {
    storage?.setItem(PROFILE_KEY, JSON.stringify(profile));
  } catch {
    // Storage can be full or disabled; the profile just won't persist
  }
};

// The saved profile, or a new random one that gets saved
export const loadProfile = (storage: Storage | undefined): Profile => {
  const saved = parseProfile(storage?.getItem(PROFILE_KEY) ?? null);
  if (saved) {
    return saved;
  }
  const profile = randomProfile();
  saveProfile(storage, profile);
  return profile;
};

export const initials = (name: string): string => {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  const letters =
    words.length > 1
      ? `${words[0]?.[0]}${words.at(-1)?.[0]}`
      : name.slice(0, 2);
  return letters.toUpperCase();
};

// Light colors (yellow, mint) need dark text on top to stay readable
export const isLightColor = (hex: string): boolean => {
  const value = Number.parseInt(hex.slice(1), 16);
  const red = Math.floor(value / 65_536) % 256;
  const green = Math.floor(value / 256) % 256;
  const blue = value % 256;
  return 0.299 * red + 0.587 * green + 0.114 * blue > 170;
};
