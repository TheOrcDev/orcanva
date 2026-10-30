import { describe, expect, it } from "vitest";

import {
  applyWrites,
  composeDocument,
  diffDocument,
  mergeChangeSets,
  writesFor,
  writesOf,
} from "@/lib/collab/changeset";
import type { EditorDocument } from "@/lib/collab/changeset";
import { createBoxElement, createDocument } from "@/lib/document/factories";
import type { DesignElement } from "@/lib/document/schema";
import {
  insertElement,
  moveElementTo,
  removeElements,
  updateElement,
} from "@/lib/editor/document-ops";

const PAGE = { height: 720, width: 1280 };

const box = (id: string): DesignElement => ({
  ...createBoxElement("rect", PAGE),
  id,
});

const start = (): EditorDocument => {
  const { background, height, width } = createDocument(PAGE);
  return composeDocument({ background, height, width }, [
    { element: box("a"), position: "a0" },
    { element: box("b"), position: "a1" },
    { element: box("c"), position: "a2" },
  ]);
};

const ids = (editor: EditorDocument) =>
  editor.document.elements.map((element) => element.id);

describe("diffDocument", () => {
  it("records only the element that changed", () => {
    const current = start();
    const { changes } = diffDocument(
      current,
      updateElement(current.document, "b", { x: 99 })
    );

    expect([...changes.elements.keys()]).toEqual(["b"]);
    expect(changes.elements.get("b")?.after?.element.x).toBe(99);
    expect(changes.elements.get("b")?.before?.element.x).not.toBe(99);
    expect(changes.page).toBeNull();
  });

  it("records creates and deletes with a null side", () => {
    const current = start();
    const added = diffDocument(
      current,
      insertElement(current.document, box("d"))
    );
    expect(added.changes.elements.get("d")?.before).toBeNull();
    expect((added.editor.positions.get("d") ?? "") > "a2").toBe(true);

    const removed = diffDocument(
      current,
      removeElements(current.document, ["a"])
    );
    expect(removed.changes.elements.get("a")?.after).toBeNull();
  });

  it("rewrites only the moved element's key on reorder", () => {
    const current = start();
    const { changes, editor } = diffDocument(
      current,
      moveElementTo(current.document, "a", 2)
    );

    expect([...changes.elements.keys()]).toEqual(["a"]);
    expect(ids(editor)).toEqual(["b", "c", "a"]);
  });

  it("records page changes", () => {
    const current = start();
    const { changes } = diffDocument(current, {
      ...current.document,
      width: 1920,
    });
    expect(changes.page?.before.width).toBe(1280);
    expect(changes.page?.after.width).toBe(1920);
  });
});

describe("applyWrites", () => {
  it("re-sorts by key and applies deletes", () => {
    const current = start();
    const next = applyWrites(current, {
      elements: new Map([
        ["a", { element: box("a"), position: "a5" }],
        ["b", null],
      ]),
      page: null,
    });
    expect(ids(next)).toEqual(["c", "a"]);
  });
});

describe("writesFor", () => {
  it("undoes a create as a delete and a delete as a restore", () => {
    const current = start();
    const added = diffDocument(
      current,
      insertElement(current.document, box("d"))
    );
    expect(
      writesFor(added.changes, "undo", added.editor).elements.get("d")
    ).toBeNull();

    const removed = diffDocument(
      current,
      removeElements(current.document, ["a"])
    );
    const restore = writesFor(removed.changes, "undo", removed.editor);
    expect(restore.elements.get("a")?.position).toBe("a0");
  });

  it("doesn't bring back an element someone else deleted", () => {
    const current = start();
    const moved = diffDocument(
      current,
      updateElement(current.document, "b", { x: 50 })
    );
    // Another person deletes "b" before the undo
    const afterRemoteDelete = applyWrites(moved.editor, {
      elements: new Map([["b", null]]),
      page: null,
    });
    const undo = writesFor(moved.changes, "undo", afterRemoteDelete);
    expect(undo.elements.has("b")).toBe(false);
  });

  it("writes the after state for redo", () => {
    const current = start();
    const { changes, editor } = diffDocument(
      current,
      updateElement(current.document, "c", { y: 7 })
    );
    expect(writesFor(changes, "redo", editor)).toEqual(writesOf(changes));
  });
});

describe("mergeChangeSets", () => {
  it("keeps the first before and the last after", () => {
    const current = start();
    const first = diffDocument(
      current,
      updateElement(current.document, "a", { x: 1 })
    );
    const second = diffDocument(
      first.editor,
      updateElement(first.editor.document, "a", { x: 2 })
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
      updateElement(current.document, "a", { x: 1 })
    );
    const back = diffDocument(first.editor, {
      ...first.editor.document,
      elements: first.editor.document.elements.map((element) =>
        element.id === "a" && original ? original : element
      ),
    });
    expect(mergeChangeSets(first.changes, back.changes).elements.size).toBe(0);
  });
});
