import type Konva from "konva";

import type { DesignDocument } from "@/lib/document/schema";
import type { EditorStoreApi } from "@/lib/editor/store";
import { selectDocument } from "@/lib/editor/store";
import { prepareForRender } from "@/lib/export/prepare";
import { renderThumbnail } from "@/lib/export/render-page";

export const THUMBNAIL_IDLE_MS = 4000;

export interface Thumbnailer {
  schedule: (delayMs?: number) => void;
  // Renders and uploads now if the document changed since the last preview;
  // "retry" means a text edit was in progress and nothing was rendered
  flush: () => Promise<"done" | "retry">;
  dispose: () => void;
}

const uploadThumbnail = async (designId: string, blob: Blob) => {
  const response = await fetch(`/api/designs/${designId}/thumbnail`, {
    body: blob,
    headers: { "Content-Type": "image/jpeg" },
    method: "PUT",
  });
  if (!response.ok) {
    throw new Error(`Thumbnail upload failed with ${response.status}`);
  }
};

export const createThumbnailer = ({
  store,
  getPageNode,
  hasThumbnail,
}: {
  store: EditorStoreApi;
  getPageNode: () => Konva.Group | null;
  hasThumbnail: boolean;
}): Thumbnailer => {
  let rendered: DesignDocument | null = hasThumbnail
    ? selectDocument(store.getState())
    : null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: Promise<unknown> | null = null;
  let disposed = false;

  const generate = async (): Promise<"done" | "retry"> => {
    const node = getPageNode();
    const state = store.getState();
    const document = selectDocument(state);
    if (!node || document === rendered) {
      return "done";
    }
    // An in-progress text edit is hidden on canvas; wait until it's done
    if (state.editingTextId) {
      return "retry";
    }
    await prepareForRender(document);
    await uploadThumbnail(
      state.designId,
      await renderThumbnail(node, document)
    );
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
