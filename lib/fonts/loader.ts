import type { DesignDocument } from "@/lib/document/schema";
import { registerRenderPreparer } from "@/lib/export/prepare";
import {
  fontPreviewUrl,
  fontStylesheetUrl,
  getFont,
  nearestWeight,
} from "@/lib/fonts/catalog";
import type { FontDefinition } from "@/lib/fonts/catalog";

const stylesheets = new Map<string, Promise<void>>();
const loadedStylesheets = new Set<string>();

// document.fonts.load() resolves with nothing if the @font-face rules
// aren't parsed yet, so the stylesheet must finish loading first.
const ensureStylesheet = (font: FontDefinition): Promise<void> => {
  let pending = stylesheets.get(font.id);
  if (!pending) {
    const { promise, reject, resolve } = Promise.withResolvers<undefined>();
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = fontStylesheetUrl(font);
    link.addEventListener("load", () => {
      loadedStylesheets.add(font.id);
      resolve(undefined);
    });
    link.addEventListener("error", () => {
      stylesheets.delete(font.id);
      link.remove();
      reject(new Error(`Could not load font ${font.family}`));
    });
    document.head.append(link);
    pending = promise;
    stylesheets.set(font.id, pending);
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
  loadedStylesheets.has(getFont(request.fontId).id) &&
  document.fonts.check(faceSpec(request), sample(request.text));

const REGISTER_RETRY_MS = 16;
const REGISTER_ATTEMPTS = 60;

const wait = (ms: number): Promise<undefined> => {
  const { promise, resolve } = Promise.withResolvers<undefined>();
  setTimeout(() => resolve(undefined), ms);
  return promise;
};

// The <link> load event fires before the browser registers the sheet's
// @font-face rules; until then fonts.load() matches nothing and resolves
// with no faces. Retry briefly until the faces exist and have loaded.
const loadFaces = async (
  spec: string,
  text: string,
  attemptsLeft: number
): Promise<void> => {
  const faces = await document.fonts.load(spec, text);
  if (faces.length > 0) {
    return;
  }
  if (attemptsLeft <= 0) {
    throw new Error(`No font faces registered for ${spec}`);
  }
  await wait(REGISTER_RETRY_MS);
  return loadFaces(spec, text, attemptsLeft - 1);
};

export const ensureFont = async (request: FontRequest): Promise<void> => {
  await ensureStylesheet(getFont(request.fontId));
  await loadFaces(faceSpec(request), sample(request.text), REGISTER_ATTEMPTS);
};

const waitForFonts = async (document: DesignDocument): Promise<void> => {
  const requests = document.elements.flatMap((element) =>
    element.type === "text" && element.visible
      ? [
          {
            fontId: element.fontId,
            italic: element.italic,
            text: element.uppercase ? element.text.toUpperCase() : element.text,
            weight: element.weight,
          },
        ]
      : []
  );
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
