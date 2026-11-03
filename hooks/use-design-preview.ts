"use client";

import type Konva from "konva";
import { useEffect, useState } from "react";

import { usePageNodeRef } from "@/components/editor/canvas-context";
import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import type { Size } from "@/lib/document/geometry";
import type { DesignDocument } from "@/lib/document/schema";
import { selectDocument } from "@/lib/editor/store";
import type { EditorStoreApi } from "@/lib/editor/store";
import { prepareForRender } from "@/lib/export/prepare";
import { renderPage } from "@/lib/export/render-page";

// How long after the last change the preview draws again
const RERENDER_DELAY_MS = 300;
// Sharp enough for the widest slot (a 390px phone feed) on a 2× screen
const PREVIEW_MAX_WIDTH = 1000;
const PREVIEW_QUALITY = 0.85;

export interface DesignPreview {
  // One JPEG for every slot that shows the design
  url: string;
  // The design's size when it was drawn
  size: Size;
}

// Draws the design now and again after each change settles, until stopped.
// Each picture is a blob URL that's revoked when the next one replaces it,
// and when it stops.
const startPreviews = (
  store: EditorStoreApi,
  getPageNode: () => Konva.Group | null,
  show: (preview: DesignPreview | null) => void
): (() => void) => {
  let stopped = false;
  let url: string | null = null;
  let rendered: DesignDocument | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  // A change arrived while drawing: draw again afterwards
  let again = false;

  const draw = async (node: Konva.Group, document: DesignDocument) => {
    await prepareForRender(document);
    const blob = await renderPage(node, document, {
      format: "jpeg",
      pixelRatio: Math.min(1, PREVIEW_MAX_WIDTH / document.width),
      quality: PREVIEW_QUALITY,
    });
    if (stopped) {
      return;
    }
    rendered = document;
    const next = URL.createObjectURL(blob);
    if (url) {
      URL.revokeObjectURL(url);
    }
    url = next;
    show({ size: { height: document.height, width: document.width }, url });
  };

  const render = async () => {
    if (running) {
      again = true;
      return;
    }
    const node = getPageNode();
    // The canvas mounts once the workspace has a size: try again shortly
    if (!node) {
      clearTimeout(timer);
      timer = setTimeout(render, RERENDER_DELAY_MS);
      return;
    }
    const state = store.getState();
    const document = selectDocument(state);
    if (state.editingTextId || document === rendered) {
      return;
    }
    running = true;
    // On failure the last picture stays up, and the next change tries again
    await draw(node, document).catch(() => null);
    running = false;
    if (again && !stopped) {
      again = false;
      clearTimeout(timer);
      timer = setTimeout(render, RERENDER_DELAY_MS);
    }
  };

  render();
  const unsubscribe = store.subscribe((state, previous) => {
    const typingEnded =
      previous.editingTextId !== null && state.editingTextId === null;
    if (selectDocument(state) !== selectDocument(previous) || typingEnded) {
      clearTimeout(timer);
      timer = setTimeout(render, RERENDER_DELAY_MS);
    }
  });

  return () => {
    stopped = true;
    clearTimeout(timer);
    unsubscribe();
    if (url) {
      URL.revokeObjectURL(url);
    }
    show(null);
  };
};

// The design as a small JPEG, drawn the way Download draws it, while
// `active`. Edits from anyone, collaborators included, draw it again once
// they settle. A text being typed into is hidden on the canvas, so the
// preview waits until the typing ends.
export const useDesignPreview = (active: boolean): DesignPreview | null => {
  const store = useEditorStoreApi();
  const pageNodeRef = usePageNodeRef();
  const [preview, setPreview] = useState<DesignPreview | null>(null);

  useEffect(() => {
    if (!active) {
      return;
    }
    return startPreviews(store, () => pageNodeRef.current, setPreview);
  }, [active, store, pageNodeRef]);

  return preview;
};
