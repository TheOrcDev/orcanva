import { MAX_COPY_BYTES } from "@/lib/document/element-input";
import type { ResizedCopyInput } from "@/lib/document/element-input";
import type { Size } from "@/lib/document/geometry";
import type { DesignDocument, TextElement } from "@/lib/document/schema";
import { resizeWithLayout } from "@/lib/editor/magic-resize";
import type { ResizeLayout, TextSize } from "@/lib/editor/magic-resize";
import { selectDocument, selectWholeDesign } from "@/lib/editor/store";
import type { EditorStoreApi } from "@/lib/editor/store";
import { isFontReady, waitForFonts } from "@/lib/fonts/loader";
import { canvasMeasurer } from "@/lib/text/canvas";
import { measureTextElement } from "@/lib/text/element-layout";

// A text's box as this browser draws it. Fonts must have loaded, or it
// measures the fallback family.
export const measureInBrowser = (text: TextElement): TextSize =>
  measureTextElement(text, canvasMeasurer, isFontReady);

// Resizes the open design in place, every page, as one undo step, after
// finishing crops and typing. Returns that step (null when nothing
// changed), so an Undo button can check it's still the latest.
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
    await waitForFonts(selectWholeDesign(store.getState())).catch(() => null);
  }
  const before = store.getState().history.past.at(-1);
  store
    .getState()
    .changeAllPages((document) =>
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

const MAX_NAME_LENGTH = 120;

// "Launch · Story / Shorts"
export const copyName = (name: string, sizeLabel: string): string => {
  const suffix = ` · ${sizeLabel}`;
  return `${name.slice(0, MAX_NAME_LENGTH - suffix.length).trim()}${suffix}`;
};

export class CopyTooLargeError extends Error {
  constructor() {
    super("This design is too big to copy in one go.");
    this.name = "CopyTooLargeError";
  }
}

// The open design laid out at `size`, and that as the input for a new
// design: its elements keep their ids and z-order keys. Fonts must have
// loaded.
export const resizedCopyOf = (
  store: EditorStoreApi,
  size: Size,
  layout: ResizeLayout,
  name: string
): { document: DesignDocument; input: ResizedCopyInput } => {
  const state = store.getState();
  const document = resizeWithLayout(
    selectDocument(state),
    size,
    layout,
    measureInBrowser
  );
  const { positions } = state.doc;
  const input = {
    background: document.background,
    elements: document.elements.flatMap((element) => {
      const position = positions.get(element.id);
      return position ? [{ data: element, position }] : [];
    }),
    height: size.height,
    name,
    sourceId: state.designId,
    width: size.width,
  };
  if (new TextEncoder().encode(JSON.stringify(input)).length > MAX_COPY_BYTES) {
    throw new CopyTooLargeError();
  }
  return { document, input };
};
