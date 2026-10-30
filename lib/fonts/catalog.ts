export type FontCategory = "display" | "sans" | "serif" | "mono" | "script";

export interface FontDefinition {
  id: string;
  family: string;
  category: FontCategory;
  // Only weights Google Fonts actually serves, otherwise the CSS2 API 400s
  weights: readonly number[];
  italic: boolean;
}

const VARIABLE_100_900 = [100, 200, 300, 400, 500, 600, 700, 800, 900];

export const FONT_CATALOG = [
  // Display: the thumbnail workhorses
  {
    category: "display",
    family: "Anton",
    id: "anton",
    italic: false,
    weights: [400],
  },
  {
    category: "display",
    family: "Bebas Neue",
    id: "bebas-neue",
    italic: false,
    weights: [400],
  },
  {
    category: "display",
    family: "Bangers",
    id: "bangers",
    italic: false,
    weights: [400],
  },
  {
    category: "display",
    family: "Luckiest Guy",
    id: "luckiest-guy",
    italic: false,
    weights: [400],
  },
  {
    category: "display",
    family: "Archivo Black",
    id: "archivo-black",
    italic: false,
    weights: [400],
  },
  {
    category: "display",
    family: "Bowlby One",
    id: "bowlby-one",
    italic: false,
    weights: [400],
  },
  {
    category: "display",
    family: "Titan One",
    id: "titan-one",
    italic: false,
    weights: [400],
  },
  {
    category: "display",
    family: "Lilita One",
    id: "lilita-one",
    italic: false,
    weights: [400],
  },
  {
    category: "display",
    family: "Bungee",
    id: "bungee",
    italic: false,
    weights: [400],
  },
  {
    category: "display",
    family: "Russo One",
    id: "russo-one",
    italic: false,
    weights: [400],
  },
  {
    category: "display",
    family: "Black Ops One",
    id: "black-ops-one",
    italic: false,
    weights: [400],
  },
  {
    category: "display",
    family: "Permanent Marker",
    id: "permanent-marker",
    italic: false,
    weights: [400],
  },
  {
    category: "display",
    family: "Righteous",
    id: "righteous",
    italic: false,
    weights: [400],
  },
  {
    category: "display",
    family: "Teko",
    id: "teko",
    italic: false,
    weights: [300, 400, 500, 600, 700],
  },
  {
    category: "display",
    family: "Staatliches",
    id: "staatliches",
    italic: false,
    weights: [400],
  },
  {
    category: "display",
    family: "Alfa Slab One",
    id: "alfa-slab-one",
    italic: false,
    weights: [400],
  },
  {
    category: "display",
    family: "Oswald",
    id: "oswald",
    italic: false,
    weights: [200, 300, 400, 500, 600, 700],
  },
  // Sans
  {
    category: "sans",
    family: "Inter",
    id: "inter",
    italic: true,
    weights: VARIABLE_100_900,
  },
  {
    category: "sans",
    family: "Montserrat",
    id: "montserrat",
    italic: true,
    weights: VARIABLE_100_900,
  },
  {
    category: "sans",
    family: "Poppins",
    id: "poppins",
    italic: true,
    weights: VARIABLE_100_900,
  },
  {
    category: "sans",
    family: "Roboto",
    id: "roboto",
    italic: true,
    weights: VARIABLE_100_900,
  },
  {
    category: "sans",
    family: "Open Sans",
    id: "open-sans",
    italic: true,
    weights: [300, 400, 500, 600, 700, 800],
  },
  {
    category: "sans",
    family: "Lato",
    id: "lato",
    italic: true,
    weights: [100, 300, 400, 700, 900],
  },
  {
    category: "sans",
    family: "Raleway",
    id: "raleway",
    italic: true,
    weights: VARIABLE_100_900,
  },
  {
    category: "sans",
    family: "Nunito",
    id: "nunito",
    italic: true,
    weights: [200, 300, 400, 500, 600, 700, 800, 900],
  },
  {
    category: "sans",
    family: "Work Sans",
    id: "work-sans",
    italic: true,
    weights: VARIABLE_100_900,
  },
  {
    category: "sans",
    family: "Figtree",
    id: "figtree",
    italic: true,
    weights: [300, 400, 500, 600, 700, 800, 900],
  },
  {
    category: "sans",
    family: "DM Sans",
    id: "dm-sans",
    italic: true,
    weights: VARIABLE_100_900,
  },
  {
    category: "sans",
    family: "Space Grotesk",
    id: "space-grotesk",
    italic: false,
    weights: [300, 400, 500, 600, 700],
  },
  {
    category: "sans",
    family: "Outfit",
    id: "outfit",
    italic: false,
    weights: VARIABLE_100_900,
  },
  // Serif
  {
    category: "serif",
    family: "Playfair Display",
    id: "playfair-display",
    italic: true,
    weights: [400, 500, 600, 700, 800, 900],
  },
  {
    category: "serif",
    family: "Merriweather",
    id: "merriweather",
    italic: true,
    weights: [300, 400, 700, 900],
  },
  {
    category: "serif",
    family: "DM Serif Display",
    id: "dm-serif-display",
    italic: true,
    weights: [400],
  },
  {
    category: "serif",
    family: "Abril Fatface",
    id: "abril-fatface",
    italic: false,
    weights: [400],
  },
  {
    category: "serif",
    family: "Lora",
    id: "lora",
    italic: true,
    weights: [400, 500, 600, 700],
  },
  // Mono
  {
    category: "mono",
    family: "JetBrains Mono",
    id: "jetbrains-mono",
    italic: true,
    weights: [100, 200, 300, 400, 500, 600, 700, 800],
  },
  {
    category: "mono",
    family: "Space Mono",
    id: "space-mono",
    italic: true,
    weights: [400, 700],
  },
  // Script
  {
    category: "script",
    family: "Pacifico",
    id: "pacifico",
    italic: false,
    weights: [400],
  },
  {
    category: "script",
    family: "Lobster",
    id: "lobster",
    italic: false,
    weights: [400],
  },
  {
    category: "script",
    family: "Caveat",
    id: "caveat",
    italic: false,
    weights: [400, 500, 600, 700],
  },
] as const satisfies readonly FontDefinition[];

export const FONT_CATEGORY_LABELS: Record<FontCategory, string> = {
  display: "Display",
  mono: "Monospace",
  sans: "Sans serif",
  script: "Script",
  serif: "Serif",
};

export const FALLBACK_FAMILIES: Record<FontCategory, string> = {
  display: "Impact, sans-serif",
  mono: "monospace",
  sans: "sans-serif",
  script: "cursive",
  serif: "serif",
};

export const DEFAULT_FONT_ID = "anton";

const fontsById = new Map<string, FontDefinition>(
  FONT_CATALOG.map((font) => [font.id, font])
);

export const getFont = (fontId: string): FontDefinition =>
  fontsById.get(fontId) ?? fontsById.get(DEFAULT_FONT_ID) ?? FONT_CATALOG[0];

// Nearest weight the font actually ships, so switching fonts never breaks
export const nearestWeight = (font: FontDefinition, weight: number): number => {
  let best = font.weights[0] ?? 400;
  for (const candidate of font.weights) {
    if (Math.abs(candidate - weight) < Math.abs(best - weight)) {
      best = candidate;
    }
  }
  return best;
};

export const cssFamily = (font: FontDefinition): string => `"${font.family}"`;

export const konvaFontStyle = (weight: number, italic: boolean): string =>
  italic ? `italic ${weight}` : `${weight}`;

const GOOGLE_FONTS_CSS = "https://fonts.googleapis.com/css2";

const axisSpec = (font: FontDefinition): string => {
  if (font.italic) {
    const normal = font.weights.map((weight) => `0,${weight}`);
    const italic = font.weights.map((weight) => `1,${weight}`);
    return `:ital,wght@${[...normal, ...italic].join(";")}`;
  }
  if (font.weights.length === 1 && font.weights[0] === 400) {
    return "";
  }
  return `:wght@${font.weights.join(";")}`;
};

// One stylesheet per family; font files only download when a face is used
export const fontStylesheetUrl = (font: FontDefinition): string =>
  `${GOOGLE_FONTS_CSS}?family=${font.family.replaceAll(" ", "+")}${axisSpec(font)}&display=block`;

export const fontPreviewUrl = (font: FontDefinition): string =>
  `${GOOGLE_FONTS_CSS}?family=${font.family.replaceAll(" ", "+")}&text=${encodeURIComponent(font.family)}`;
