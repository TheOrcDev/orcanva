// What the editor's WebMCP tools need from the browser: drawing the page,
// measuring text with its real font, the graphics catalog, uploads,
// templates and the in-browser AI tools, each the same code the editor's
// own buttons use
import type Konva from "konva";
import type { RefObject } from "react";

import { loadTemplate } from "@/lib/actions/templates";
import { removeImageBackground } from "@/lib/editor/background-removal";
import { sourcePhoto } from "@/lib/editor/derived-images";
import { measureInBrowser } from "@/lib/editor/resize-design";
import { selectDocument } from "@/lib/editor/store";
import type { EditorStoreApi } from "@/lib/editor/store";
import { upscaleImage } from "@/lib/editor/upscale";
import { prepareForRender } from "@/lib/export/prepare";
import { downloadBlob, renderPage } from "@/lib/export/render-page";
import { ensureFont } from "@/lib/fonts/loader";
import { findGraphic, loadCatalog, loadEntries } from "@/lib/graphics/catalog";
import { searchGraphics } from "@/lib/graphics/search";
import { prepareImage } from "@/lib/upload/prepare-image";
import { uploadImage } from "@/lib/upload/upload-images";
import { upscaleOptions } from "@/lib/upscale/options";
import type { EditorToolDeps } from "@/lib/webmcp/tools";

const FILE_NAME = /[^/]+$/u;

// A name for a downloaded image, from its URL
const fileNameOf = (url: string, type: string): string => {
  const fromPath = FILE_NAME.exec(new URL(url).pathname)?.[0];
  if (fromPath?.includes(".")) {
    return decodeURIComponent(fromPath);
  }
  return `image.${type.split("/")[1] ?? "png"}`;
};

const fetchImage = async (url: string): Promise<File> => {
  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    // Most often the other site doesn't allow pages to read its images
    throw new Error(
      `Couldn't fetch ${url} from the browser (the site may block it). Try another URL, or ask the person to drop the file onto the canvas.`
    );
  }
  if (!response.ok) {
    throw new Error(`Couldn't download ${url} (${response.status})`);
  }
  const blob = await response.blob();
  return new File([blob], fileNameOf(url, blob.type), { type: blob.type });
};

export const browserToolDeps = ({
  notify,
  pageNode,
  store,
}: {
  store: EditorStoreApi;
  // The page on screen's Konva group, as Download draws it
  pageNode: RefObject<Konva.Group | null>;
  notify: (message: string) => void;
}): EditorToolDeps => ({
  download: downloadBlob,
  loadTemplate: (templateId) =>
    loadTemplate({ designId: store.getState().designId, templateId }),
  measureText: async (text) => {
    await ensureFont({
      fontId: text.fontId,
      italic: text.italic,
      text: text.uppercase ? text.text.toUpperCase() : text.text,
      weight: text.weight,
    });
    const { height, width } = measureInBrowser(text);
    return { height, width };
  },
  notify,
  removeBackground: async (elementId) => {
    await removeImageBackground(store, elementId);
  },
  render: async (options) => {
    await prepareForRender(selectDocument(store.getState()));
    const node = pageNode.current;
    if (!node) {
      throw new Error("The page isn't on screen");
    }
    const { height, width } = selectDocument(store.getState());
    return renderPage(node, { height, width }, options);
  },
  resolveGraphic: async (idOrQuery) => {
    const known = await findGraphic(idOrQuery);
    if (known) {
      return known;
    }
    const { search } = await loadCatalog();
    const [best] = searchGraphics(search, idOrQuery, "all");
    const [entry] = best ? await loadEntries([best]) : [];
    if (!entry) {
      throw new Error(`No graphic matches "${idOrQuery}"; try search_graphics`);
    }
    return entry;
  },
  searchGraphics: async (query, kind, limit) => {
    const { search } = await loadCatalog();
    return searchGraphics(search, query, kind)
      .slice(0, limit)
      .map(([id, rowKind, name]) => ({ id, kind: rowKind, name }));
  },
  store,
  uploadFromUrl: async (url) => {
    if (!/^https?:\/\//iu.test(url)) {
      throw new Error(
        "Give an http(s) URL; local files can't be read from the browser"
      );
    }
    const prepared = await prepareImage(await fetchImage(url));
    return uploadImage(prepared, store.getState().designId);
  },
  upscale: async (elementId, factor) => {
    const options = upscaleOptions(sourcePhoto(store, elementId));
    const option =
      options.find(
        (candidate) => candidate.variant === `upscaled-${factor}x`
      ) ?? options.at(-1);
    if (!option) {
      throw new Error(
        "This photo is already about as large as uploads go (4096px)"
      );
    }
    await upscaleImage(store, elementId, option);
    return option.factor;
  },
});
