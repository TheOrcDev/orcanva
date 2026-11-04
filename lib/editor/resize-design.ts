import type { Size } from "@/lib/document/geometry";
import type { TextElement } from "@/lib/document/schema";
import { resizeWithLayout } from "@/lib/editor/magic-resize";
import type { ResizeLayout, TextSize } from "@/lib/editor/magic-resize";
import { selectDocument } from "@/lib/editor/store";
import type { EditorStoreApi } from "@/lib/editor/store";
import { isFontReady, waitForFonts } from "@/lib/fonts/loader";
import { canvasMeasurer } from "@/lib/text/canvas";
import { measureTextElement } from "@/lib/text/element-layout";

// A text's box as this browser draws it. Fonts must have loaded, or it
// measures the fallback family.
export const measureInBrowser = (text: TextElement): TextSize =>
  measureTextElement(text, canvasMeasurer, isFontReady);

// Resizes the open design in place as one undo step, after finishing
// crops and typing. Returns that step (null when nothing changed), so an
// Undo button can check it's still the latest.
export const resizeInPlace = async (
  store: EditorStoreApi,
  size: Size,
  layout: ResizeLayout
): Promise<object | null> => {
  const state = store.getState();
  state.finishCrop(true);
  state.finishPageCrop(false);
  state.setEditingText(null);
  if (layout === "magic") {
    // Measured in a fallback font, text would wrap wrongly
    await waitForFonts(selectDocument(store.getState())).catch(() => null);
  }
  const before = store.getState().history.past.at(-1);
  store
    .getState()
    .change((document) =>
      resizeWithLayout(document, size, layout, measureInBrowser)
    );
  const after = store.getState().history.past.at(-1);
  if (after === before) {
    return null;
  }
  store.getState().zoomToFit();
  return after ?? null;
};

// Undoes a resize if it's still the latest step; false when something
// came after it
export const undoResize = (store: EditorStoreApi, step: object): boolean => {
  if (store.getState().history.past.at(-1) !== step) {
    return false;
  }
  store.getState().undo();
  store.getState().zoomToFit();
  return true;
};
