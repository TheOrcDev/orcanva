import { describe, expect, it } from "vitest";

import { createBoxElement, createDocument } from "@/lib/document/factories";
import {
  insertElement,
  moveElementTo,
  removeElements,
  updateElement,
} from "@/lib/editor/document-ops";
import { createEditorStore, selectDocument } from "@/lib/editor/store";
import type { EditorInit } from "@/lib/editor/store";

const PAGE = { height: 720, width: 1280 };

const setup = () => {
  const store = createEditorStore({
    assets: [],
    designId: "d",
    document: createDocument(PAGE),
    hasThumbnail: false,
    libraryIds: [],
    name: "Test",
    role: "owner",
    viewer: null,
    visibility: "public",
  });
  const rect = createBoxElement("rect", PAGE);
  store.getState().change((doc) => insertElement(doc, rect));
  return { rect, store };
};

describe("editor store", () => {
  it("makes a crop one undo step, or nothing when cancelled", () => {
    const { rect, store } = setup();
    const x = () => selectDocument(store.getState()).elements[0]?.x;

    store.getState().startCrop(rect.id);
    expect(store.getState().held.has(rect.id)).toBe(true);
    store.getState().change((doc) => updateElement(doc, rect.id, { x: 5 }));
    store.getState().change((doc) => updateElement(doc, rect.id, { x: 6 }));
    store.getState().finishCrop(false);
    expect(x()).toBe(rect.x);
    expect(store.getState().cropTargetId).toBeNull();

    store.getState().startCrop(rect.id);
    store.getState().change((doc) => updateElement(doc, rect.id, { x: 7 }));
    store.getState().finishCrop(true);
    expect(x()).toBe(7);
    expect(store.getState().held.has(rect.id)).toBe(false);
    store.getState().undo();
    expect(x()).toBe(rect.x);
  });

  it("crops the page in one undo step, or not at all when cancelled", () => {
    const { rect, store } = setup();
    const page = () => selectDocument(store.getState());
    store.getState().select([rect.id]);

    store.getState().startPageCrop();
    expect(store.getState().selectedIds).toEqual([]);
    expect(store.getState().pageCrop).toEqual({ ...PAGE, x: 0, y: 0 });
    store.getState().setPageCrop({ height: 300, width: 400, x: 10, y: 20 });
    store.getState().finishPageCrop(false);
    expect(store.getState().pageCrop).toBeNull();
    expect(page().width).toBe(PAGE.width);

    store.getState().startPageCrop();
    store.getState().setPageCrop({ height: 300, width: 400, x: 10, y: 20 });
    store.getState().finishPageCrop(true);
    expect(page()).toMatchObject({ height: 300, width: 400 });
    expect(page().elements[0]).toMatchObject({
      x: rect.x - 10,
      y: rect.y - 20,
    });
    store.getState().undo();
    expect(page()).toMatchObject(PAGE);
    expect(page().elements[0]).toMatchObject({ x: rect.x, y: rect.y });
  });

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

  it("restores a deleted element at its old place in the stack", () => {
    const { rect, store } = setup();
    const top = createBoxElement("ellipse", PAGE);
    store.getState().change((doc) => insertElement(doc, top));
    store.getState().change((doc) => removeElements(doc, [rect.id]));

    store.getState().undo();
    const ids = selectDocument(store.getState()).elements.map(
      (element) => element.id
    );
    expect(ids).toEqual([rect.id, top.id]);
  });

  it("undoes a reorder", () => {
    const { rect, store } = setup();
    const top = createBoxElement("ellipse", PAGE);
    store.getState().change((doc) => insertElement(doc, top));
    store.getState().change((doc) => moveElementTo(doc, rect.id, 1));
    const order = () =>
      selectDocument(store.getState()).elements.map((element) => element.id);
    expect(order()).toEqual([top.id, rect.id]);

    store.getState().undo();
    expect(order()).toEqual([rect.id, top.id]);
    store.getState().redo();
    expect(order()).toEqual([top.id, rect.id]);
  });

  it("starts connecting only when the server sent live queries", () => {
    const base: EditorInit = {
      assets: [],
      designId: "d",
      document: createDocument(PAGE),
      hasThumbnail: false,
      libraryIds: [],
      name: "Test",
      role: "owner",
      viewer: null,
      visibility: "public",
    };
    expect(createEditorStore(base).getState().liveStatus).toBe("off");
    const sealed = { capability: "x", expiresAt: 0, queryFingerprint: "f" };
    const live = {
      elements: sealed,
      page: sealed,
      presence: sealed,
      url: "wss://realtime.example",
    };
    expect(createEditorStore({ ...base, live }).getState().liveStatus).toBe(
      "connecting"
    );
  });

  it("clamps zoom and switches to manual mode", () => {
    const { store } = setup();
    store.getState().setZoom(100);
    expect(store.getState()).toMatchObject({ zoom: 8, zoomMode: "manual" });
    store.getState().zoomToFit();
    expect(store.getState().zoomMode).toBe("fit");
  });

  it("stops an editor (but not the owner or a member) when the design goes private", () => {
    const row = {
      background: { color: "#ffffff", type: "solid" },
      height: PAGE.height,
      name: "Test",
      version: 1,
      width: PAGE.width,
    };
    const init: EditorInit = {
      assets: [],
      designId: "d",
      document: createDocument(PAGE),
      hasThumbnail: false,
      libraryIds: [],
      name: "Test",
      role: "editor",
      viewer: null,
      visibility: "public",
    };
    const editor = createEditorStore(init);
    editor.getState().applyLivePage({ ...row, visibility: "public" });
    expect(editor.getState().accessLost).toBe(false);
    editor.getState().applyLivePage({ ...row, visibility: "private" });
    expect(editor.getState().accessLost).toBe(true);

    const owner = createEditorStore({ ...init, role: "owner" });
    owner.getState().applyLivePage({ ...row, visibility: "private" });
    expect(owner.getState().accessLost).toBe(false);
    expect(owner.getState().visibility).toBe("private");

    // Shared with them: they stay
    const member = createEditorStore({ ...init, role: "member" });
    member.getState().applyLivePage({ ...row, visibility: "private" });
    expect(member.getState().accessLost).toBe(false);
  });
});
