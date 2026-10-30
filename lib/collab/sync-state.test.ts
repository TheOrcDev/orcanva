import { describe, expect, it } from "vitest";

import { composeDocument } from "@/lib/collab/changeset";
import type { EditorDocument, Entry } from "@/lib/collab/changeset";
import {
  EMPTY_PENDING,
  addWrites,
  dropBatch,
  isPendingEmpty,
  rebase,
  settleBatch,
  syncedFromDocument,
} from "@/lib/collab/sync-state";
import type { BatchSeqs, SyncedState } from "@/lib/collab/sync-state";
import { createBoxElement, createDocument } from "@/lib/document/factories";
import type { DesignElement } from "@/lib/document/schema";

const PAGE = { height: 720, width: 1280 };
const { background, height, width } = createDocument(PAGE);

const box = (id: string, x = 0): DesignElement => ({
  ...createBoxElement("rect", PAGE),
  id,
  x,
});

const entry = (id: string, x: number, position: string): Entry => ({
  element: box(id, x),
  position,
});

const start = (): EditorDocument =>
  composeDocument({ background, height, width }, [
    entry("a", 0, "a0"),
    entry("b", 0, "a1"),
  ]);

const xOf = (editor: EditorDocument, id: string) =>
  editor.document.elements.find((element) => element.id === id)?.x;

const ids = (editor: EditorDocument) =>
  editor.document.elements.map((element) => element.id);

const batchOf = (elements: [string, number][]): BatchSeqs => ({
  elements: new Map(elements),
  name: null,
  page: null,
});

describe("addWrites", () => {
  it("marks new elements as creates and existing ones as updates", () => {
    const pending = addWrites(
      EMPTY_PENDING,
      {
        elements: new Map([
          ["a", entry("a", 5, "a0")],
          ["c", entry("c", 0, "a2")],
        ]),
        page: null,
      },
      new Set(["a", "b"]),
      1
    );
    expect(pending.elements.get("a")?.create).toBe(false);
    expect(pending.elements.get("c")?.create).toBe(true);
  });

  it("keeps a create a create until it is confirmed", () => {
    let pending = addWrites(
      EMPTY_PENDING,
      { elements: new Map([["c", entry("c", 0, "a2")]]), page: null },
      new Set(),
      1
    );
    pending = addWrites(
      pending,
      { elements: new Map([["c", entry("c", 9, "a2")]]), page: null },
      new Set(["c"]),
      2
    );
    expect(pending.elements.get("c")).toMatchObject({ create: true, seq: 2 });
  });
});

describe("settleBatch", () => {
  it("keeps writes made after the batch was sent", () => {
    const current = start();
    let pending = addWrites(
      EMPTY_PENDING,
      { elements: new Map([["a", entry("a", 1, "a0")]]), page: null },
      new Set(["a", "b"]),
      1
    );
    const sent = batchOf([["a", 1]]);
    pending = addWrites(
      pending,
      { elements: new Map([["a", entry("a", 2, "a0")]]), page: null },
      new Set(["a", "b"]),
      2
    );
    const settled = settleBatch(
      pending,
      syncedFromDocument(current, "Name"),
      sent,
      false
    );
    expect(settled.pending.elements.get("a")?.seq).toBe(2);
  });

  it("promotes confirmed writes to synced when nothing will echo them", () => {
    const synced = syncedFromDocument(start(), "Name");
    const pending = addWrites(
      EMPTY_PENDING,
      { elements: new Map([["b", null]]), page: null },
      new Set(["a", "b"]),
      1
    );
    const settled = settleBatch(pending, synced, batchOf([["b", 1]]), true);
    expect(isPendingEmpty(settled.pending)).toBe(true);
    expect(settled.synced.elements.has("b")).toBe(false);
  });
});

describe("rebase", () => {
  it("shows pending writes on top of the server state", () => {
    const current = start();
    const synced: SyncedState = {
      ...syncedFromDocument(current, "Name"),
      elements: new Map([
        ["a", entry("a", 50, "a0")],
        ["b", entry("b", 0, "a1")],
      ]),
    };
    const pending = addWrites(
      EMPTY_PENDING,
      { elements: new Map([["b", entry("b", 7, "a1")]]), page: null },
      new Set(["a", "b"]),
      1
    );
    const next = rebase(synced, pending, current, new Set());

    expect(xOf(next, "a")).toBe(50);
    expect(xOf(next, "b")).toBe(7);
  });

  it("drops a refused write back to the server's version", () => {
    const current = start();
    const synced = syncedFromDocument(current, "Name");
    const pending = addWrites(
      EMPTY_PENDING,
      { elements: new Map([["a", entry("a", 9, "a0")]]), page: null },
      new Set(["a", "b"]),
      1
    );
    const dropped = dropBatch(pending, batchOf([["a", 1]]));
    expect(xOf(rebase(synced, dropped, current, new Set()), "a")).toBe(0);
  });

  it("keeps a held element where the local gesture has it", () => {
    const current = start();
    const synced: SyncedState = {
      ...syncedFromDocument(current, "Name"),
      elements: new Map([
        ["a", entry("a", 80, "a0")],
        ["b", entry("b", 0, "a1")],
      ]),
    };
    const next = rebase(synced, EMPTY_PENDING, current, new Set(["a"]));
    expect(xOf(next, "a")).toBe(0);
  });

  it("returns the same document when the server echoes it back", () => {
    const current = start();
    // Fresh objects with the same content, like rows decoded from Postgres
    const echoed = syncedFromDocument(
      composeDocument({ background: { ...background }, height, width }, [
        entry("a", 0, "a0"),
        entry("b", 0, "a1"),
      ]),
      "Name"
    );
    const next = rebase(echoed, EMPTY_PENDING, current, new Set());
    expect(next).toBe(current);
  });

  it("orders elements by their keys", () => {
    const current = start();
    const synced: SyncedState = {
      ...syncedFromDocument(current, "Name"),
      elements: new Map([
        ["a", entry("a", 0, "a5")],
        ["b", entry("b", 0, "a1")],
      ]),
    };
    expect(ids(rebase(synced, EMPTY_PENDING, current, new Set()))).toEqual([
      "b",
      "a",
    ]);
  });
});
