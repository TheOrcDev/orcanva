import { describe, expect, it } from "vitest";

import { createBoxElement, createDocument } from "@/lib/document/factories";
import { insertElement, updateElement } from "@/lib/editor/document-ops";
import { createEditorStore, selectDocument } from "@/lib/editor/store";

const PAGE = { height: 720, width: 1280 };
const blue = { color: "#0000ff", type: "solid" } as const;
const white = createDocument(PAGE).background;

const box = (id: string, x = 0) => ({
  ...createBoxElement("rect", PAGE),
  id,
  x,
});

// A design of two pages: "d" (the first, the design's id) holding a, and
// "p2" (blue) holding b
const setup = () => {
  const first = { ...createDocument(PAGE), elements: [box("a")] };
  const second = {
    ...createDocument(PAGE),
    background: blue,
    elements: [box("b")],
  };
  const store = createEditorStore({
    assets: [],
    designId: "d",
    document: first,
    hasThumbnail: false,
    libraryIds: [],
    name: "Carousel",
    pages: [
      { document: first, id: "d", position: "a0", positions: { a: "a0" } },
      { document: second, id: "p2", position: "a1", positions: { b: "a0" } },
    ],
    role: "owner",
    viewer: null,
    visibility: "public",
  });
  return store;
};

const shownIds = (store: ReturnType<typeof setup>) =>
  selectDocument(store.getState()).elements.map((element) => element.id);

describe("editor store with pages", () => {
  it("opens on the first page and holds every page", () => {
    const store = setup();
    const state = store.getState();
    expect(state.activePageId).toBe("d");
    expect(state.pages.map((page) => page.id)).toEqual(["d", "p2"]);
    expect(shownIds(store)).toEqual(["a"]);
    expect(state.synced.elements.get("b")?.pageId).toBe("p2");
  });

  it("puts what's added on the page on screen, and queues it there", () => {
    const store = setup();
    store.getState().setActivePage("p2");
    store.getState().change((doc) => insertElement(doc, box("c")));
    expect(shownIds(store)).toEqual(["b", "c"]);
    expect(store.getState().pending.elements.get("c")).toMatchObject({
      create: true,
      entry: { pageId: "p2" },
    });
  });

  it("writes a background change as the page's, and a resize as the design's", () => {
    const store = setup();
    store.getState().setActivePage("p2");
    store
      .getState()
      .change((doc) => ({ ...doc, background: white, width: 1080 }));
    const { pending, pages } = store.getState();
    expect(pending.pages.get("p2")?.entry).toEqual({
      background: white,
      position: "a1",
    });
    expect(pending.size?.value).toEqual({ height: 720, width: 1080 });
    // Every page takes the size
    expect(pages.map((page) => page.doc.document.width)).toEqual([1080, 1080]);
  });

  it("switching pages drops the selection and what's being typed", () => {
    const store = setup();
    store.getState().select(["a"]);
    store.getState().setEditingText("a");
    store.getState().setActivePage("p2");
    const state = store.getState();
    expect(state.activePageId).toBe("p2");
    expect(state.selectedIds).toEqual([]);
    expect(state.editingTextId).toBeNull();
    expect(shownIds(store)).toEqual(["b"]);
    // A page that doesn't exist changes nothing
    store.getState().setActivePage("nope");
    expect(store.getState().activePageId).toBe("p2");
  });

  it("shows pages others add, and their elements only on their page", () => {
    const store = setup();
    store.getState().applyLivePages([
      { background: white, id: "d", position: "a0" },
      { background: blue, id: "p2", position: "a1" },
      { background: white, id: "p3", position: "a2" },
    ]);
    store.getState().applyLiveElements([
      { data: box("a"), id: "a", page_id: "d", position: "a0" },
      { data: box("b"), id: "b", page_id: "p2", position: "a0" },
      { data: box("z"), id: "z", page_id: "p3", position: "a0" },
    ]);
    const { pages } = store.getState();
    expect(pages.map((page) => page.id)).toEqual(["d", "p2", "p3"]);
    expect(
      pages[2]?.doc.document.elements.map((element) => element.id)
    ).toEqual(["z"]);
    expect(shownIds(store)).toEqual(["a"]);
  });

  it("moves to the next page when someone deletes the one on screen", () => {
    const store = setup();
    store.getState().applyLivePages([
      { background: white, id: "d", position: "a0" },
      { background: blue, id: "p2", position: "a1" },
      { background: white, id: "p3", position: "a2" },
    ]);
    store.getState().setActivePage("p2");
    store.getState().select(["b"]);
    store.getState().applyLivePages([
      { background: white, id: "d", position: "a0" },
      { background: white, id: "p3", position: "a2" },
    ]);
    const state = store.getState();
    expect(state.activePageId).toBe("p3");
    expect(state.selectedIds).toEqual([]);
  });

  it("keeps the design's one page when it has no page rows", () => {
    const store = setup();
    store.getState().applyLivePages([]);
    expect(store.getState().pages.map((page) => page.id)).toEqual(["d"]);
    expect(store.getState().storedPages).toBe(false);
    // Its background then comes from the design row
    store.getState().applyLivePage({
      background: blue,
      height: 720,
      name: "Carousel",
      version: 1,
      visibility: "public",
      width: 1280,
    });
    expect(selectDocument(store.getState()).background).toEqual(blue);
  });

  it("puts live rows without a page on the first page", () => {
    const store = setup();
    store.getState().applyLiveElements([
      { data: box("a", 5), id: "a", page_id: null, position: "a0" },
      { data: box("b"), id: "b", page_id: "p2", position: "a0" },
    ]);
    expect(selectDocument(store.getState()).elements[0]?.x).toBe(5);
  });

  it("undo writes back to the page the step was on", () => {
    const store = setup();
    store.getState().setActivePage("p2");
    store.getState().change((doc) => updateElement(doc, "b", { x: 40 }));
    store.getState().setActivePage("d");
    store.getState().undo();
    const { pending } = store.getState();
    expect(pending.elements.get("b")?.entry?.pageId).toBe("p2");
    expect(pending.elements.get("b")?.entry?.element.x).toBe(0);
  });
});
