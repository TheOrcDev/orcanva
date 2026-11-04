import { describe, expect, it } from "vitest";

import {
  applyWrites,
  composeDocument,
  composePages,
  contentOf,
  diffDocument,
  mergeChangeSets,
  pagesOfStep,
  writesFor,
  writesOf,
} from "@/lib/collab/changeset";
import type {
  ChangeSet,
  DesignContent,
  EditorDocument,
  Entry,
  PageEntry,
  PageView,
} from "@/lib/collab/changeset";
import { createBoxElement, createDocument } from "@/lib/document/factories";
import type { DesignElement } from "@/lib/document/schema";
import {
  insertElement,
  moveElementTo,
  removeElements,
  updateElement,
} from "@/lib/editor/document-ops";

const PAGE = { height: 720, width: 1280 };
const ONE = { id: "p1", position: "a0" };

const box = (id: string): DesignElement => ({
  ...createBoxElement("rect", PAGE),
  id,
});

const white = createDocument(PAGE).background;
const blue = { color: "#0000ff", type: "solid" } as const;

const start = (): EditorDocument =>
  composeDocument({ ...PAGE, background: white }, [
    { element: box("a"), position: "a0" },
    { element: box("b"), position: "a1" },
    { element: box("c"), position: "a2" },
  ]);

const ids = (editor: EditorDocument) =>
  editor.document.elements.map((element) => element.id);

const entry = (id: string, pageId: string, position = "a0"): Entry => ({
  element: box(id),
  pageId,
  position,
});

// Two pages: p1 holds a and b, p2 holds c
const twoPages = (): DesignContent => ({
  elements: new Map([
    ["a", entry("a", "p1", "a0")],
    ["b", entry("b", "p1", "a1")],
    ["c", entry("c", "p2", "a0")],
  ]),
  pages: new Map<string, PageEntry>([
    ["p1", { background: white, position: "a0" }],
    ["p2", { background: blue, position: "a1" }],
  ]),
  size: PAGE,
});

const pageIds = (pages: readonly PageView[]) => pages.map((page) => page.id);

describe("diffDocument", () => {
  it("records only the element that changed, on its page", () => {
    const current = start();
    const { changes } = diffDocument(
      current,
      updateElement(current.document, "b", { x: 99 }),
      ONE
    );

    expect([...changes.elements.keys()]).toEqual(["b"]);
    expect(changes.elements.get("b")?.after?.element.x).toBe(99);
    expect(changes.elements.get("b")?.after?.pageId).toBe("p1");
    expect(changes.elements.get("b")?.before?.element.x).not.toBe(99);
    expect(changes.pages.size).toBe(0);
    expect(changes.size).toBeNull();
  });

  it("records creates and deletes with a null side", () => {
    const current = start();
    const added = diffDocument(
      current,
      insertElement(current.document, box("d")),
      ONE
    );
    expect(added.changes.elements.get("d")?.before).toBeNull();
    expect((added.editor.positions.get("d") ?? "") > "a2").toBe(true);

    const removed = diffDocument(
      current,
      removeElements(current.document, ["a"]),
      ONE
    );
    expect(removed.changes.elements.get("a")?.after).toBeNull();
  });

  it("rewrites only the moved element's key on reorder", () => {
    const current = start();
    const { changes, editor } = diffDocument(
      current,
      moveElementTo(current.document, "a", 2),
      ONE
    );

    expect([...changes.elements.keys()]).toEqual(["a"]);
    expect(ids(editor)).toEqual(["b", "c", "a"]);
  });

  it("records a background as the page's and a width as the design's size", () => {
    const current = start();
    const { changes } = diffDocument(
      current,
      { ...current.document, background: blue, width: 1920 },
      ONE
    );
    expect(changes.pages.get("p1")).toEqual({
      after: { background: blue, position: "a0" },
      before: { background: white, position: "a0" },
    });
    expect(changes.size?.before.width).toBe(1280);
    expect(changes.size?.after.width).toBe(1920);
  });
});

describe("composePages", () => {
  it("puts each element on its page, pages in order", () => {
    const pages = composePages(twoPages(), []);
    expect(pageIds(pages)).toEqual(["p1", "p2"]);
    expect(ids(pages[0]?.doc ?? start())).toEqual(["a", "b"]);
    expect(ids(pages[1]?.doc ?? start())).toEqual(["c"]);
    expect(pages[1]?.doc.document.background).toBe(blue);
    expect(pages[1]?.doc.document.width).toBe(1280);
  });

  it("keeps pages that didn't change as they were", () => {
    const content = twoPages();
    const before = composePages(content, []);
    const elements = new Map([
      ...content.elements,
      ["c", { ...entry("c", "p2"), element: { ...box("c"), x: 5 } }],
    ]);
    const after = composePages({ ...content, elements }, before);
    expect(after[0]).toBe(before[0]);
    expect(after[1]).not.toBe(before[1]);
    expect(composePages(content, before)).toBe(before);
  });

  it("leaves out elements whose page is gone", () => {
    const content = twoPages();
    const pages = new Map([...content.pages].filter(([id]) => id !== "p2"));
    expect(
      composePages({ ...content, pages }, []).flatMap((page) => ids(page.doc))
    ).toEqual(["a", "b"]);
  });

  it("round-trips through contentOf", () => {
    const pages = composePages(twoPages(), []);
    const content = contentOf(pages);
    expect(content.elements.get("c")?.pageId).toBe("p2");
    expect(content.pages.get("p2")?.background).toBe(blue);
    expect(content.size).toEqual(PAGE);
  });
});

describe("applyWrites", () => {
  it("applies element and page writes and deletes", () => {
    const next = applyWrites(twoPages(), {
      elements: new Map([
        ["a", entry("a", "p3", "a5")],
        ["b", null],
      ]),
      pages: new Map<string, PageEntry | null>([
        ["p3", { background: white, position: "a2" }],
        ["p2", null],
      ]),
      size: { height: 1080, width: 1920 },
    });
    expect([...next.pages.keys()]).toEqual(["p1", "p3"]);
    expect([...next.elements.keys()]).toEqual(["a", "c"]);
    expect(next.size.width).toBe(1920);
  });
});

// Deleting page 2 the way the store does: the page and each element on it
const deletePage2 = (): ChangeSet => ({
  elements: new Map([["c", { after: null, before: entry("c", "p2") }]]),
  pages: new Map([
    ["p2", { after: null, before: { background: blue, position: "a1" } }],
  ]),
  size: null,
});

describe("writesFor", () => {
  it("undoes a create as a delete and a delete as a restore", () => {
    const current = start();
    const added = diffDocument(
      current,
      insertElement(current.document, box("d")),
      ONE
    );
    const content = contentOf([
      { doc: added.editor, id: "p1", position: "a0" },
    ]);
    expect(
      writesFor(added.changes, "undo", content).elements.get("d")
    ).toBeNull();

    const removed = diffDocument(
      current,
      removeElements(current.document, ["a"]),
      ONE
    );
    const restore = writesFor(
      removed.changes,
      "undo",
      contentOf([{ doc: removed.editor, id: "p1", position: "a0" }])
    );
    expect(restore.elements.get("a")?.position).toBe("a0");
  });

  it("undoing a page delete brings back the page and its elements", () => {
    const after = applyWrites(twoPages(), writesOf(deletePage2()));
    const undo = writesFor(deletePage2(), "undo", after);
    expect(undo.pages.get("p2")).toEqual({ background: blue, position: "a1" });
    expect(undo.elements.get("c")?.pageId).toBe("p2");
  });

  it("doesn't bring back an element someone else deleted", () => {
    const content = twoPages();
    const moved: ChangeSet = {
      elements: new Map([
        [
          "b",
          {
            after: {
              ...entry("b", "p1", "a1"),
              element: { ...box("b"), x: 5 },
            },
            before: entry("b", "p1", "a1"),
          },
        ],
      ]),
      pages: new Map(),
      size: null,
    };
    const afterRemoteDelete = applyWrites(content, {
      elements: new Map([["b", null]]),
      pages: new Map(),
      size: null,
    });
    const undo = writesFor(moved, "undo", afterRemoteDelete);
    expect(undo.elements.has("b")).toBe(false);
  });

  it("skips pages others deleted, and edits to elements on them", () => {
    const content = twoPages();
    const recolour: ChangeSet = {
      elements: new Map([
        [
          "c",
          {
            after: { ...entry("c", "p2"), element: { ...box("c"), x: 9 } },
            before: entry("c", "p2"),
          },
        ],
      ]),
      pages: new Map([
        [
          "p2",
          {
            after: { background: white, position: "a1" },
            before: { background: blue, position: "a1" },
          },
        ],
      ]),
      size: null,
    };
    // Someone deletes page 2 (and with it c)
    const gone = applyWrites(content, writesOf(deletePage2()));
    const undo = writesFor(recolour, "undo", gone);
    expect(undo.pages.size).toBe(0);
    expect(undo.elements.size).toBe(0);
  });

  it("doesn't bring an element back onto a page that's gone", () => {
    const content = twoPages();
    // This step deleted c; since then someone deleted its page
    const removedC: ChangeSet = {
      elements: new Map([["c", { after: null, before: entry("c", "p2") }]]),
      pages: new Map(),
      size: null,
    };
    const gone = applyWrites(content, writesOf(deletePage2()));
    expect(writesFor(removedC, "undo", gone).elements.has("c")).toBe(false);
  });

  it("writes the after state for redo", () => {
    const current = start();
    const { changes, editor } = diffDocument(
      current,
      updateElement(current.document, "c", { y: 7 }),
      ONE
    );
    expect(
      writesFor(
        changes,
        "redo",
        contentOf([{ doc: editor, id: "p1", position: "a0" }])
      )
    ).toEqual(writesOf(changes));
  });
});

describe("pagesOfStep", () => {
  it("lists the pages a step changes", () => {
    expect(pagesOfStep(deletePage2(), "undo")).toEqual(["p2"]);
    // Redoing the delete leaves page 2's element named, but not the page
    expect(pagesOfStep(deletePage2(), "redo")).toEqual(["p2"]);
  });
});

describe("mergeChangeSets", () => {
  it("keeps the first before and the last after", () => {
    const current = start();
    const first = diffDocument(
      current,
      updateElement(current.document, "a", { x: 1 }),
      ONE
    );
    const second = diffDocument(
      first.editor,
      updateElement(first.editor.document, "a", { x: 2 }),
      ONE
    );
    const merged = mergeChangeSets(first.changes, second.changes);

    expect(merged.elements.get("a")?.before?.element.x).toBe(
      current.document.elements[0]?.x
    );
    expect(merged.elements.get("a")?.after?.element.x).toBe(2);
  });

  it("drops elements that ended where they started", () => {
    const current = start();
    const [original] = current.document.elements;
    const first = diffDocument(
      current,
      updateElement(current.document, "a", { x: 1 }),
      ONE
    );
    const back = diffDocument(
      first.editor,
      {
        ...first.editor.document,
        elements: first.editor.document.elements.map((element) =>
          element.id === "a" && original ? original : element
        ),
      },
      ONE
    );
    expect(mergeChangeSets(first.changes, back.changes).elements.size).toBe(0);
  });

  it("merges pages and the size, dropping those back where they started", () => {
    const current = start();
    const bluer = diffDocument(
      current,
      { ...current.document, background: blue, width: 1920 },
      ONE
    );
    const back = diffDocument(
      bluer.editor,
      { ...bluer.editor.document, background: white },
      ONE
    );
    const merged = mergeChangeSets(bluer.changes, back.changes);
    expect(merged.pages.size).toBe(0);
    expect(merged.size).toEqual({
      after: { height: 720, width: 1920 },
      before: PAGE,
    });
  });
});
