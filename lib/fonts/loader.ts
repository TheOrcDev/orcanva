import type { DesignDocument } from "@/lib/document/schema";
import { registerRenderPreparer } from "@/lib/export/prepare";
import {
  fontPreviewUrl,
  fontStylesheetUrl,
  getFont,
  nearestWeight,
} from "@/lib/fonts/catalog";
import type { FontDefinition } from "@/lib/fonts/catalog";

const FONT_FACE_BLOCK = /@font-face\s*\{(?<body>[^}]*)\}/gu;
const FAMILY_DESCRIPTOR = /font-family:\s*['"]?(?<value>[^;'"]+)['"]?;/u;
const STYLE_DESCRIPTOR = /font-style:\s*(?<value>[^;]+);/u;
const WEIGHT_DESCRIPTOR = /font-weight:\s*(?<value>[^;]+);/u;
const SRC_DESCRIPTOR = /src:\s*(?<value>[^;]+);/u;
const RANGE_DESCRIPTOR = /unicode-range:\s*(?<value>[^;]+);/u;

const registrations = new Map<string, Promise<void>>();
const registeredFonts = new Set<string>();

export interface FontFaceRule {
  family: string;
  src: string;
  style: string;
  weight: string;
  unicodeRange: string;
}

// Reads the @font-face rules out of a Google Fonts CSS2 response
export const parseFontFaces = (css: string): FontFaceRule[] =>
  [...css.matchAll(FONT_FACE_BLOCK)].flatMap((match) => {
    const body = match.groups?.body ?? "";
    const family = FAMILY_DESCRIPTOR.exec(body)?.groups?.value;
    const src = SRC_DESCRIPTOR.exec(body)?.groups?.value;
    if (!family || !src) {
      return [];
    }
    return [
      {
        family: family.trim(),
        src: src.trim(),
        style: STYLE_DESCRIPTOR.exec(body)?.groups?.value.trim() ?? "normal",
        unicodeRange:
          RANGE_DESCRIPTOR.exec(body)?.groups?.value.trim() ?? "U+0-10FFFF",
        weight: WEIGHT_DESCRIPTOR.exec(body)?.groups?.value.trim() ?? "400",
      },
    ];
  });

// Fetches the family's Google Fonts CSS and registers every face directly
// with document.fonts. (A <link> stylesheet registers its faces on the
// browser's own schedule, so fonts.load() could race it and find nothing.)
// Font files still only download for the faces and subsets text needs.
const registerFont = (font: FontDefinition): Promise<void> => {
  let pending = registrations.get(font.id);
  if (!pending) {
    pending = (async () => {
      const response = await fetch(fontStylesheetUrl(font));
      if (!response.ok) {
        throw new Error(`Could not load font ${font.family}`);
      }
      for (const rule of parseFontFaces(await response.text())) {
        document.fonts.add(
          new FontFace(rule.family, rule.src, {
            display: "block",
            style: rule.style,
            unicodeRange: rule.unicodeRange,
            weight: rule.weight,
          })
        );
      }
      registeredFonts.add(font.id);
    })();
    pending.catch(() => registrations.delete(font.id));
    registrations.set(font.id, pending);
  }
  return pending;
};

export interface FontRequest {
  fontId: string;
  weight: number;
  italic: boolean;
  // The text being drawn: Google serves unicode-range subsets, so the
  // characters decide which files must load (é, ß, Cyrillic, …)
  text: string;
}

const faceSpec = (request: FontRequest): string => {
  const font = getFont(request.fontId);
  const weight = nearestWeight(font, request.weight);
  const style = request.italic && font.italic ? "italic " : "";
  return `${style}${weight} 32px "${font.family}"`;
};

const sample = (text: string) => text || "A";

export const isFontReady = (request: FontRequest): boolean =>
  registeredFonts.has(getFont(request.fontId).id) &&
  document.fonts.check(faceSpec(request), sample(request.text));

export const ensureFont = async (request: FontRequest): Promise<void> => {
  await registerFont(getFont(request.fontId));
  await document.fonts.load(faceSpec(request), sample(request.text));
};

// Every face a text draws with: its own, and any its marks switch to
const waitForFonts = async (document: DesignDocument): Promise<void> => {
  const requests = document.elements.flatMap((element) => {
    if (element.type !== "text" || !element.visible) {
      return [];
    }
    const text = element.uppercase ? element.text.toUpperCase() : element.text;
    return [
      {
        fontId: element.fontId,
        italic: element.italic,
        text,
        weight: element.weight,
      },
      ...element.marks.map((mark) => ({
        fontId: mark.fontId ?? element.fontId,
        italic: mark.italic ?? element.italic,
        text: text.slice(mark.start, mark.end),
        weight: mark.weight ?? element.weight,
      })),
    ];
  });
  await Promise.allSettled(requests.map(ensureFont));
};

registerRenderPreparer(waitForFonts);

// Picker previews load a tiny subset (just the family name's glyphs) under
// an alias, so the subset never shadows the real family on the canvas.
const previews = new Map<string, Promise<string>>();
const SRC_URL = /url\((?<url>[^)]+)\)/u;

export const previewFamily = (font: FontDefinition): string =>
  `orcanva-preview-${font.id}`;

export const loadFontPreview = (font: FontDefinition): Promise<string> => {
  let pending = previews.get(font.id);
  if (!pending) {
    pending = (async () => {
      const response = await fetch(fontPreviewUrl(font));
      const css = await response.text();
      const url = SRC_URL.exec(css)?.groups?.url;
      if (!url) {
        throw new Error(`No preview font for ${font.family}`);
      }
      const face = new FontFace(previewFamily(font), `url(${url})`);
      await face.load();
      document.fonts.add(face);
      return previewFamily(font);
    })();
    pending.catch(() => previews.delete(font.id));
    previews.set(font.id, pending);
  }
  return pending;
};
