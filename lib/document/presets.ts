export interface SizePreset {
  id: string;
  label: string;
  description: string;
  width: number;
  height: number;
}

export const SIZE_PRESETS = [
  {
    description: "YouTube thumbnail",
    height: 720,
    id: "youtube-thumbnail",
    label: "YouTube thumbnail",
    width: 1280,
  },
  {
    description: "16:9 Full HD",
    height: 1080,
    id: "full-hd",
    label: "Full HD",
    width: 1920,
  },
  {
    description: "16:9 Ultra HD",
    height: 2160,
    id: "4k",
    label: "4K",
    width: 3840,
  },
  {
    description: "Instagram / LinkedIn post",
    height: 1080,
    id: "square",
    label: "Square",
    width: 1080,
  },
  {
    description: "Instagram portrait post",
    height: 1350,
    id: "portrait",
    label: "Portrait",
    width: 1080,
  },
  {
    description: "Stories, Shorts, Reels, TikTok",
    height: 1920,
    id: "story",
    label: "Story / Shorts",
    width: 1080,
  },
  {
    description: "X / Twitter in-feed image",
    height: 900,
    id: "x-post",
    label: "X post",
    width: 1600,
  },
  {
    description: "Link preview image",
    height: 630,
    id: "open-graph",
    label: "Open Graph",
    width: 1200,
  },
  {
    description: "LinkedIn profile banner",
    height: 396,
    id: "linkedin-banner",
    label: "LinkedIn banner",
    width: 1584,
  },
] as const satisfies readonly SizePreset[];

export type PresetId = (typeof SIZE_PRESETS)[number]["id"];

// The ids alone, for schemas that name a preset
export const PRESET_IDS = SIZE_PRESETS.map((preset) => preset.id) as [
  PresetId,
  ...PresetId[],
];

export const [DEFAULT_PRESET] = SIZE_PRESETS;

export const findPresetById = (id: string): SizePreset | undefined =>
  SIZE_PRESETS.find((preset) => preset.id === id);

export const findPresetBySize = (
  width: number,
  height: number
): SizePreset | undefined =>
  SIZE_PRESETS.find(
    (preset) => preset.width === width && preset.height === height
  );
