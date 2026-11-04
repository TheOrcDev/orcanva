import type Konva from "konva";
import { describe, expect, it } from "vitest";

import { createBoxElement, createDocument } from "@/lib/document/factories";
import type { DesignDocument } from "@/lib/document/schema";
import { updateElement } from "@/lib/editor/document-ops";
import { createEditorStore } from "@/lib/editor/store";
import { createThumbnailer } from "@/lib/export/thumbnailer";

const PAGE = { height: 720, width: 1280 };
const box = (id: string) => ({ ...createBoxElement("rect", PAGE), id });
const ids = (document: DesignDocument) =>
  document.elements.map((element) => element.id);

// A design of two pages, "d" (the first) and "p2", and a thumbnailer with
// fake drawing and uploads that record what they were given
const setup = (hasThumbnail = false) => {
  const first = { ...createDocument(PAGE), elements: [box("a")] };
  const second = { ...createDocument(PAGE), elements: [box("b")] };
  const store = createEditorStore({
    assets: [],
    designId: "d",
    document: first,
    hasThumbnail,
    libraryIds: [],
    name: "Carousel",
    pages: [
      { document: first, id: "d", position: "a0" },
      { document: second, id: "p2", position: "a1" },
    ],
    role: "owner",
    viewer: null,
    visibility: "public",
  });
  const drawn: { from: "canvas" | "offscreen"; ids: string[] }[] = [];
  const uploads: string[] = [];
  const thumbnailer = createThumbnailer({
    drawCanvas: (_node, document) => {
      drawn.push({ from: "canvas", ids: ids(document) });
      return Promise.resolve(new Blob(["canvas"]));
    },
    drawOffscreen: (document) => {
      drawn.push({ from: "offscreen", ids: ids(document) });
      return Promise.resolve(new Blob(["offscreen"]));
    },
    getPageNode: () => ({}) as Konva.Group,
    hasThumbnail,
    store,
    upload: (designId) => {
      uploads.push(designId);
      return Promise.resolve();
    },
  });
  return { drawn, store, thumbnailer, uploads };
};

describe("thumbnailer", () => {
  it("draws the first page from the canvas while it's on screen", async () => {
    const { drawn, thumbnailer, uploads } = setup();
    expect(await thumbnailer.flush()).toBe("done");
    expect(drawn).toEqual([{ from: "canvas", ids: ["a"] }]);
    expect(uploads).toEqual(["d"]);
  });

  it("draws the first page off screen while another page is on screen", async () => {
    const { drawn, store, thumbnailer } = setup();
    store.getState().setActivePage("p2");
    await thumbnailer.flush();
    expect(drawn).toEqual([{ from: "offscreen", ids: ["a"] }]);
  });

  it("leaves the preview alone when only another page changed", async () => {
    const { drawn, store, thumbnailer } = setup(true);
    store.getState().setActivePage("p2");
    store.getState().change((doc) => updateElement(doc, "b", { x: 9 }));
    await thumbnailer.flush();
    expect(drawn).toEqual([]);

    // A new first page is a new preview (the one on screen, so the canvas)
    store.getState().movePage("p2", 0);
    await thumbnailer.flush();
    expect(drawn).toEqual([{ from: "canvas", ids: ["b"] }]);
  });

  it("waits while text on the first page is being typed", async () => {
    const { drawn, store, thumbnailer } = setup();
    store.getState().setEditingText("a");
    expect(await thumbnailer.flush()).toBe("retry");
    expect(drawn).toEqual([]);
  });
});
