import type Konva from "konva";

import type { DesignDocument } from "@/lib/document/schema";
import type { EditorStoreApi } from "@/lib/editor/store";

export const THUMBNAIL_IDLE_MS = 4000;

export interface Thumbnailer {
  schedule: (delayMs?: number) => void;
  // Renders and uploads now if the first page changed since the last
  // preview; "retry" means a text edit was in progress and nothing was
  // rendered
  flush: () => Promise<"done" | "retry">;
  dispose: () => void;
}

export const uploadThumbnail = async (designId: string, blob: Blob) => {
  const response = await fetch(`/api/designs/${designId}/thumbnail`, {
    body: blob,
    headers: { "Content-Type": "image/jpeg" },
    method: "PUT",
  });
  if (!response.ok) {
    throw new Error(`Thumbnail upload failed with ${response.status}`);
  }
};

// Keeps the gallery preview, a picture of the design's first page, up to
// date. It's drawn from the canvas's page node (`drawCanvas`) while the
// first page is on screen, and off screen (`drawOffscreen`, the static page
// renderer) while another is.
export const createThumbnailer = ({
  store,
  getPageNode,
  hasThumbnail,
  drawCanvas,
  drawOffscreen,
  upload = uploadThumbnail,
}: {
  store: EditorStoreApi;
  getPageNode: () => Konva.Group | null;
  hasThumbnail: boolean;
  drawCanvas: (node: Konva.Group, document: DesignDocument) => Promise<Blob>;
  drawOffscreen: (document: DesignDocument) => Promise<Blob>;
  upload?: (designId: string, blob: Blob) => Promise<void>;
}): Thumbnailer => {
  const firstPage = () => {
    const state = store.getState();
    return state.pages[0] ?? null;
  };
  let rendered: DesignDocument | null = hasThumbnail
    ? (firstPage()?.doc.document ?? null)
    : null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<unknown> | null = null;
  let disposed = false;

  const generate = async (): Promise<"done" | "retry"> => {
    const state = store.getState();
    const first = firstPage();
    // Elements this tab can't draw would be missing from the preview: leave
    // it to a tab that can
    if (
      !first ||
      first.doc.document === rendered ||
      state.skippedElementIds.length > 0
    ) {
      return "done";
    }
    const { document } = first.doc;
    let blob: Blob;
    if (state.activePageId === first.id) {
      const node = getPageNode();
      if (!node) {
        return "done";
      }
      // An in-progress text edit is hidden on canvas; wait until it's done
      if (state.editingTextId) {
        return "retry";
      }
      blob = await drawCanvas(node, document);
    } else {
      blob = await drawOffscreen(document);
    }
    await upload(state.designId, blob);
    rendered = document;
    return "done";
  };

  const flush = async (): Promise<"done" | "retry"> => {
    clearTimeout(timer);
    if (running) {
      await running;
    }
    const attempt = generate().catch(() => "done" as const);
    running = attempt;
    const outcome = await attempt;
    running = null;
    return outcome;
  };

  const schedule = (delayMs = THUMBNAIL_IDLE_MS) => {
    if (disposed) {
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if ((await flush()) === "retry") {
        schedule();
      }
    }, delayMs);
  };

  const dispose = () => {
    disposed = true;
    clearTimeout(timer);
  };

  return { dispose, flush, schedule };
};
