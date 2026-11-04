import { describe, expect, it } from "vitest";

import {
  createBoxElement,
  createDocument,
  createTextElement,
} from "@/lib/document/factories";
import type { DesignDocument } from "@/lib/document/schema";
import { insertElement } from "@/lib/editor/document-ops";
import { createEditorStore, selectDocument } from "@/lib/editor/store";
import { addToPage, replacePage, sameShape } from "@/lib/templates/apply";

const THUMBNAIL = { height: 720, width: 1280 };
const STORY = { height: 1920, width: 1080 };

const template = (size = THUMBNAIL): DesignDocument => ({
  ...createDocument(size),
  background: {
    angle: 90,
    stops: [
      { color: "#ff0000", offset: 0 },
      { color: "#0000ff", offset: 1 },
    ],
    type: "linear",
  },
  elements: [
    { ...createBoxElement("rect", size), x: 0, y: 0 },
    createTextElement("heading", size),
  ],
});

const page = (size = THUMBNAIL): DesignDocument => {
  const locked = { ...createBoxElement("ellipse", size), locked: true };
  return {
    ...createDocument(size),
    elements: [locked, createTextElement("body", size)],
  };
};

describe("sameShape", () => {
  it("allows 1% either way", () => {
    expect(sameShape(THUMBNAIL, { height: 1080, width: 1920 })).toBe(true);
    expect(sameShape(THUMBNAIL, { height: 726, width: 1280 })).toBe(true);
    expect(sameShape(THUMBNAIL, { height: 740, width: 1280 })).toBe(false);
    expect(sameShape(THUMBNAIL, STORY)).toBe(false);
  });
});

describe("replacePage", () => {
  it("removes everything, locked elements too, and takes the background", () => {
    const before = page();
    const after = replacePage(before, template());
    expect(after.elements).toHaveLength(2);
    const kept = new Set(before.elements.map((element) => element.id));
    expect(after.elements.some((element) => kept.has(element.id))).toBe(false);
    expect(after.background).toEqual(template().background);
    expect(after).toMatchObject(THUMBNAIL);
  });

  it("scales the template to a page of its shape", () => {
    const after = replacePage(page({ height: 1080, width: 1920 }), template());
    expect(after).toMatchObject({ height: 1080, width: 1920 });
    expect(after.elements[0]).toMatchObject({ x: 0, y: 0 });
    const [rect] = template().elements;
    expect(after.elements[0]?.type === "rect" && after.elements[0].width).toBe(
      rect?.type === "rect" ? rect.width * 1.5 : 0
    );
  });

  it("gives a page of another shape the template's size", () => {
    const after = replacePage(page(STORY), template());
    expect(after).toMatchObject(THUMBNAIL);
  });

  it("keeps the page's size for a design of several pages, fitting the template inside", () => {
    const source = template();
    const after = replacePage(page(STORY), source, true);
    expect(after).toMatchObject(STORY);
    expect(after.background).toEqual(source.background);
    expect(after.elements).toHaveLength(source.elements.length);
    // Fitted to the story's width and centred down it
    const [first] = after.elements;
    expect(first?.x).toBeCloseTo(0);
    expect(first?.y).toBeCloseTo((1920 - 720 * (1080 / 1280)) / 2);
  });

  it("gives fresh ids each time", () => {
    const source = template();
    const first = replacePage(page(), source);
    const second = replacePage(page(), source);
    expect(first.elements[0]?.id).not.toBe(source.elements[0]?.id);
    expect(first.elements[0]?.id).not.toBe(second.elements[0]?.id);
  });
});

describe("addToPage", () => {
  it("appends copies with fresh ids, keeping the page", () => {
    const before = page();
    const source = template();
    const { document, ids } = addToPage(before, source);
    expect(document.elements).toHaveLength(4);
    expect(document.elements.slice(0, 2)).toEqual(before.elements);
    expect(document.elements.slice(2).map((element) => element.id)).toEqual(
      ids
    );
    expect(ids).not.toContain(source.elements[0]?.id);
    expect(document.background).toEqual(before.background);
    expect(document).toMatchObject(THUMBNAIL);
  });

  it("fits a template of another shape inside the page, centred", () => {
    const { document } = addToPage(page(STORY), template());
    const [rect] = document.elements.slice(2);
    // 1280×720 scaled to 1080 wide is 607.5 tall, centred on 1920
    expect(rect).toMatchObject({ x: 0, y: (1920 - 607.5) / 2 });
  });
});

describe("applying a template in the editor", () => {
  it("is one undo step", () => {
    const before = page(STORY);
    const store = createEditorStore({
      assets: [],
      designId: "d",
      document: createDocument(STORY),
      hasThumbnail: false,
      libraryIds: [],
      name: "Test",
      role: "owner",
      viewer: null,
      visibility: "public",
    });
    for (const element of before.elements) {
      store.getState().change((doc) => insertElement(doc, element));
    }
    const original = selectDocument(store.getState());

    store.getState().change((doc) => replacePage(doc, template()));
    expect(selectDocument(store.getState())).toMatchObject(THUMBNAIL);
    store.getState().undo();
    expect(selectDocument(store.getState())).toEqual(original);

    store.getState().change((doc) => addToPage(doc, template()).document);
    expect(selectDocument(store.getState()).elements).toHaveLength(4);
    store.getState().undo();
    expect(selectDocument(store.getState())).toEqual(original);
  });
});
