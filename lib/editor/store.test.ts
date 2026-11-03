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

  it("refits the page crop's box to a picked shape", () => {
    const { store } = setup();
    store.getState().startPageCrop();
    store.getState().setPageCropRatio("1:1");
    expect(store.getState().pageCrop).toEqual({
      height: 720,
      width: 720,
      x: 280,
      y: 0,
    });
    store.getState().setPageCropRatio("free");
    expect(store.getState().pageCrop?.width).toBe(720);
    store.getState().finishPageCrop(false);
    store.getState().startPageCrop();
    expect(store.getState().pageCropRatio).toBe("free");
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

  it("lists live elements it can't read, until they're gone", () => {
    const { rect, store } = setup();
    const sticker = { ...rect, id: "g1", type: "hologram" };
    store.getState().applyLiveElements([
      { data: rect, id: rect.id, position: "a0" },
      { data: sticker, id: "g1", position: "a1" },
    ]);
    expect(store.getState().skippedElementIds).toEqual(["g1"]);
    expect(selectDocument(store.getState()).elements).toEqual([rect]);

    store
      .getState()
      .applyLiveElements([{ data: rect, id: rect.id, position: "a0" }]);
    expect(store.getState().skippedElementIds).toEqual([]);
  });

  it("stops writing once the design's version is newer than this tab's", () => {
    const { rect, store } = setup();
    const row = {
      background: { color: "#ffffff", type: "solid" },
      height: PAGE.height,
      name: "Test",
      visibility: "public",
      width: PAGE.width,
    };
    store.getState().applyLivePage({ ...row, version: 1 });
    expect(store.getState().outdated).toBe(false);

    store.getState().applyLivePage({ ...row, version: 2 });
    expect(store.getState().outdated).toBe(true);
    const { doc, pending, seq } = store.getState();
    store.getState().change((d) => updateElement(d, rect.id, { x: 5 }));
    store.getState().undo();
    store.getState().rename("Renamed");
    expect(store.getState()).toMatchObject({ doc, pending, seq });

    // It doesn't come back, even if a later row looks older
    store.getState().applyLivePage({ ...row, version: 1 });
    expect(store.getState().outdated).toBe(true);
  });

  it("stops writing when told a deploy outdated this tab", () => {
    const { rect, store } = setup();
    store.getState().markOutdated();
    const { seq } = store.getState();
    store.getState().change((d) => updateElement(d, rect.id, { x: 5 }));
    store.getState().redo();
    expect(store.getState().seq).toBe(seq);
    expect(selectDocument(store.getState()).elements[0]?.x).toBe(rect.x);
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

  it("keeps the viewer's brand kit, and none for guests", () => {
    const logo = {
      height: 10,
      id: "logo",
      name: "logo.png",
      sourceAssetId: null,
      url: "/api/storage/assets/logo.png",
      width: 10,
    };
    const init: EditorInit = {
      assets: [],
      brandKit: { colors: ["#ff0000"], fonts: [], logos: [] },
      designId: "d",
      document: createDocument(PAGE),
      hasThumbnail: false,
      libraryIds: [],
      name: "Test",
      role: "owner",
      viewer: { id: "u", image: null, name: "Orc" },
      visibility: "public",
    };
    const store = createEditorStore(init);
    expect(store.getState().brandKit?.colors).toEqual(["#ff0000"]);

    const kit = { colors: [], fonts: ["anton"], logos: [logo] };
    store.getState().setBrandKit(kit);
    expect(store.getState().brandKit).toBe(kit);
    // A logo this tab hadn't seen becomes drawable
    expect(store.getState().assets).toEqual([logo]);
    // The same kit again changes nothing
    const before = store.getState();
    store.getState().setBrandKit({ ...kit });
    expect(store.getState()).toBe(before);

    // Guests have no kit, whatever they're handed
    const guest = createEditorStore({ ...init, role: "editor", viewer: null });
    expect(guest.getState().brandKit).toBeNull();
    guest.getState().setBrandKit(kit);
    expect(guest.getState().brandKit).toBeNull();
    // Signed in but handed no kit: none either
    const { brandKit: _none, ...withoutKit } = init;
    expect(createEditorStore(withoutKit).getState().brandKit).toBeNull();
  });
  it("previews a version read-only: crops and typing end, undo waits", () => {
    const { rect, store } = setup();
    const x = () => selectDocument(store.getState()).elements[0]?.x;
    store.getState().change((doc) => updateElement(doc, rect.id, { x: 5 }));
    store.getState().setHistoryOpen(true);
    store.getState().startCrop(rect.id);
    store.getState().change((doc) => updateElement(doc, rect.id, { x: 9 }));

    store.getState().previewVersion("v1");
    // The crop was kept and closed, the sheet makes way for the preview
    expect(store.getState().cropTargetId).toBeNull();
    expect(store.getState().held.size).toBe(0);
    expect(store.getState().historyOpen).toBe(false);
    expect(store.getState().previewVersionId).toBe("v1");
    expect(x()).toBe(9);

    // Undo and redo wait while the workspace is hidden
    store.getState().undo();
    expect(x()).toBe(9);
    store.getState().redo();
    expect(x()).toBe(9);

    store.getState().previewVersion(null);
    expect(store.getState().previewVersionId).toBeNull();
    store.getState().undo();
    expect(x()).toBe(5);
  });

  it("ends typing and leaves a page crop as it was when a preview opens", () => {
    const { rect, store } = setup();
    store.getState().startPageCrop();
    store.getState().setPageCrop({ height: 10, width: 10, x: 0, y: 0 });
    store.getState().setEditingText(rect.id);

    store.getState().previewVersion("v1");
    expect(store.getState().editingTextId).toBeNull();
    expect(store.getState().pageCrop).toBeNull();
    expect(selectDocument(store.getState())).toMatchObject(PAGE);
  });
  it("clears undo history when a version is restored, but keeps pending writes", () => {
    const { rect, store } = setup();
    const row = {
      background: { color: "#ffffff", type: "solid" },
      height: PAGE.height,
      name: "Test",
      restore_seq: 0,
      restored_by_name: null,
      version: 1,
      visibility: "public",
      width: PAGE.width,
    };
    store.getState().applyLivePage(row);
    store.getState().change((doc) => updateElement(doc, rect.id, { x: 5 }));
    const { history, pending } = store.getState();
    expect(history.past.length).toBeGreaterThan(0);
    expect(pending.elements.has(rect.id)).toBe(true);

    // The same restore count again changes nothing
    store.getState().applyLivePage(row);
    expect(store.getState().history).toBe(history);

    store.getState().applyLivePage({
      ...row,
      restore_seq: 1,
      restored_by_name: "Jay",
    });
    const state = store.getState();
    expect(state.history.past).toEqual([]);
    expect(state.history.future).toEqual([]);
    expect(state.pending).toBe(pending);
    expect(state.restoreSeq).toBe(1);
    expect(state.lastRestore).toEqual({ byName: "Jay", own: false, seq: 1 });
    // Undo has nothing left to take back
    store.getState().undo();
    expect(selectDocument(store.getState()).elements[0]?.x).toBe(5);

    // A row lagging behind doesn't count as another restore
    store.getState().applyLivePage({ ...row, restore_seq: 0 });
    expect(store.getState().restoreSeq).toBe(1);
  });

  it("marks restores seen while restoring as this window's own", () => {
    const store = createEditorStore({
      assets: [],
      designId: "d",
      document: createDocument(PAGE),
      hasThumbnail: false,
      libraryIds: [],
      name: "Test",
      restoreSeq: 4,
      role: "owner",
      viewer: null,
      visibility: "public",
    });
    const row = {
      background: { color: "#ffffff", type: "solid" },
      height: PAGE.height,
      name: "Test",
      version: 1,
      visibility: "public",
      width: PAGE.width,
    };
    // Rows from before version history say nothing about restores
    store.getState().applyLivePage(row);
    expect(store.getState().restoreSeq).toBe(4);

    store.getState().beginRestore();
    store.getState().applyLivePage({
      ...row,
      restore_seq: 5,
      restored_by_name: "Me",
    });
    store.getState().endRestore();
    expect(store.getState().lastRestore).toEqual({
      byName: "Me",
      own: true,
      seq: 5,
    });
    expect(store.getState().restoring).toBe(false);
  });
});
