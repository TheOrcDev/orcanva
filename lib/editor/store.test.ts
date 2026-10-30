import { describe, expect, it } from "vitest";

import { createBoxElement, createDocument } from "@/lib/document/factories";
import {
  insertElement,
  removeElements,
  updateElement,
} from "@/lib/editor/document-ops";
import { createEditorStore, selectDocument } from "@/lib/editor/store";

const PAGE = { height: 720, width: 1280 };

const setup = () => {
  const store = createEditorStore({
    assets: [],
    designId: "d",
    document: createDocument(PAGE),
    hasThumbnail: false,
    name: "Test",
  });
  const rect = createBoxElement("rect", PAGE);
  store.getState().change((doc) => insertElement(doc, rect));
  return { rect, store };
};

describe("editor store", () => {
  it("makes a whole drag gesture a single undo step", () => {
    const { rect, store } = setup();
    const { begin, change, end, undo } = store.getState();

    begin();
    for (const x of [10, 20, 30]) {
      change((doc) => updateElement(doc, rect.id, { x }));
    }
    end();

    expect(selectDocument(store.getState()).elements[0]?.x).toBe(30);
    undo();
    expect(selectDocument(store.getState()).elements[0]?.x).toBe(rect.x);
  });

  it("drops selections of elements removed by undo or deletion", () => {
    const { rect, store } = setup();
    store.getState().select([rect.id]);

    store.getState().undo();
    expect(store.getState().selectedIds).toEqual([]);

    store.getState().redo();
    store.getState().select([rect.id]);
    store.getState().change((doc) => removeElements(doc, [rect.id]));
    expect(store.getState().selectedIds).toEqual([]);
  });

  it("clamps zoom and switches to manual mode", () => {
    const { store } = setup();
    store.getState().setZoom(100);
    expect(store.getState()).toMatchObject({ zoom: 8, zoomMode: "manual" });
    store.getState().zoomToFit();
    expect(store.getState().zoomMode).toBe("fit");
  });
});
