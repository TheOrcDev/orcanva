import { describe, expect, it } from "vitest";

import { composePages } from "@/lib/collab/changeset";
import type {
  DesignContent,
  Entry,
  PageEntry,
  PageView,
} from "@/lib/collab/changeset";
import {
  EMPTY_PENDING,
  addWrites,
  dropBatch,
  echoTransaction,
  hasUnsentWrites,
  rebase,
  settleBatch,
  syncedFrom,
  unechoedTransactions,
} from "@/lib/collab/sync-state";
import type {
  BatchSeqs,
  PendingWrites,
  SyncedState,
} from "@/lib/collab/sync-state";
import { createBoxElement, createDocument } from "@/lib/document/factories";
import type { DesignElement } from "@/lib/document/schema";

const PAGE = { height: 720, width: 1280 };
const { background } = createDocument(PAGE);
const blue = { color: "#0000ff", type: "solid" } as const;

const box = (id: string, x = 0): DesignElement => ({
  ...createBoxElement("rect", PAGE),
  id,
  x,
});

const entry = (
  id: string,
  x: number,
  position: string,
  pageId = "p1"
): Entry => ({
  element: box(id, x),
  pageId,
  position,
});

const page = (position: string, color = background): PageEntry => ({
  background: color,
  position,
});

const content = (
  elements: Entry[] = [entry("a", 0, "a0"), entry("b", 0, "a1")],
  pages: [string, PageEntry][] = [["p1", page("a0")]]
): DesignContent => ({
  elements: new Map(elements.map((item) => [item.element.id, item])),
  pages: new Map(pages),
  size: PAGE,
});

const start = (): PageView[] => composePages(content(), []);
const synced = (from: DesignContent = content()): SyncedState =>
  syncedFrom(from, "Name");

const xOf = (pages: readonly PageView[], id: string) =>
  pages
    .flatMap((view) => view.doc.document.elements)
    .find((element) => element.id === id)?.x;

const ids = (view: PageView | undefined) =>
  view?.doc.document.elements.map((element) => element.id) ?? [];

const existing = (elements: string[], pages: string[] = ["p1"]) => ({
  elements: new Set(elements),
  pages: new Set(pages),
});

const noPages = { pages: new Map(), size: null };

const batchOf = (
  elements: [string, number][],
  pages: [string, number][] = []
): BatchSeqs => ({
  elements: new Map(elements),
  name: null,
  pages: new Map(pages),
  size: null,
});

const queue = (
  pending: PendingWrites,
  elements: [string, Entry | null][],
  seq: number,
  pages: [string, PageEntry | null][] = []
) =>
  addWrites(
    pending,
    { elements: new Map(elements), pages: new Map(pages), size: null },
    existing(["a", "b"]),
    seq
  );

describe("addWrites", () => {
  it("marks new elements and pages as creates and existing ones as updates", () => {
    const pending = queue(
      EMPTY_PENDING,
      [
        ["a", entry("a", 5, "a0")],
        ["c", entry("c", 0, "a2")],
      ],
      1,
      [
        ["p1", page("a0", blue)],
        ["p2", page("a1")],
      ]
    );
    expect(pending.elements.get("a")?.create).toBe(false);
    expect(pending.elements.get("c")?.create).toBe(true);
    expect(pending.pages.get("p1")?.create).toBe(false);
    expect(pending.pages.get("p2")?.create).toBe(true);
  });

  it("keeps a create a create until it is confirmed", () => {
    let pending = addWrites(
      EMPTY_PENDING,
      { elements: new Map([["c", entry("c", 0, "a2")]]), ...noPages },
      existing([]),
      1
    );
    pending = addWrites(
      pending,
      { elements: new Map([["c", entry("c", 9, "a2")]]), ...noPages },
      existing(["c"]),
      2
    );
    expect(pending.elements.get("c")).toMatchObject({ create: true, seq: 2 });
  });

  it("queues the size", () => {
    const pending = addWrites(
      EMPTY_PENDING,
      {
        elements: new Map(),
        pages: new Map(),
        size: { height: 1080, width: 1920 },
      },
      existing([]),
      3
    );
    expect(pending.size).toEqual({
      seq: 3,
      txid: null,
      value: { height: 1080, width: 1920 },
    });
    expect(hasUnsentWrites(pending)).toBe(true);
  });
});

describe("settleBatch", () => {
  it("keeps writes made after the batch was sent", () => {
    let pending = queue(EMPTY_PENDING, [["a", entry("a", 1, "a0")]], 1);
    const sent = batchOf([["a", 1]]);
    pending = queue(pending, [["a", entry("a", 2, "a0")]], 2);
    const settled = settleBatch(pending, synced(), sent, "echoed", "10");
    expect(settled.pending.elements.get("a")).toMatchObject({
      seq: 2,
      txid: null,
    });
  });

  it("promotes confirmed writes to synced when nothing will echo them", () => {
    const pending = queue(EMPTY_PENDING, [["b", null]], 1, [
      ["p2", page("a1")],
    ]);
    const settled = settleBatch(
      pending,
      synced(),
      batchOf([["b", 1]], [["p2", 1]]),
      "final",
      "10"
    );
    expect(settled.pending.elements.size).toBe(0);
    expect(settled.pending.pages.size).toBe(0);
    expect(settled.synced.elements.has("b")).toBe(false);
    expect(settled.synced.pages.has("p2")).toBe(true);
  });

  it("keeps a committed write on top until its transaction is echoed", () => {
    const pending = queue(EMPTY_PENDING, [["a", entry("a", 9, "a0")]], 1, [
      ["p2", page("a1")],
    ]);
    const settled = settleBatch(
      pending,
      synced(),
      batchOf([["a", 1]], [["p2", 1]]),
      "committed",
      "42"
    );
    expect(hasUnsentWrites(settled.pending)).toBe(false);
    expect(settled.pending.elements.get("a")?.txid).toBe("42");
    expect(settled.pending.pages.get("p2")?.txid).toBe("42");
    expect(unechoedTransactions(settled.pending).get("42")).toEqual({
      elements: true,
      page: false,
      pages: true,
    });

    // A live result that lags behind the database still shows our writes
    const lagging = rebase(synced(), settled.pending, start(), new Set());
    expect(xOf(lagging, "a")).toBe(9);
    expect(lagging.map((view) => view.id)).toEqual(["p1", "p2"]);
    const echoed = echoTransaction(settled.pending, "42");
    expect(echoed.elements.size).toBe(0);
    expect(echoed.pages.size).toBe(0);
  });
});

describe("rebase", () => {
  it("shows pending writes on top of the server state", () => {
    const server = synced(content([entry("a", 50, "a0"), entry("b", 0, "a1")]));
    const pending = queue(EMPTY_PENDING, [["b", entry("b", 7, "a1")]], 1);
    const next = rebase(server, pending, start(), new Set());

    expect(xOf(next, "a")).toBe(50);
    expect(xOf(next, "b")).toBe(7);
  });

  it("shows a pending page and the elements created on it", () => {
    const pending = queue(
      EMPTY_PENDING,
      [["c", entry("c", 0, "a0", "p2")]],
      1,
      [["p2", page("a1", blue)]]
    );
    const current = start();
    const next = rebase(synced(), pending, current, new Set());
    expect(next.map((view) => view.id)).toEqual(["p1", "p2"]);
    expect(ids(next[1])).toEqual(["c"]);
    expect(next[1]?.doc.document.background).toBe(blue);
    // The page that didn't change keeps its object
    expect(next[0]).toBe(current[0]);
  });

  it("drops a refused write back to the server's version", () => {
    const pending = queue(EMPTY_PENDING, [["a", entry("a", 9, "a0")]], 1);
    const dropped = dropBatch(pending, batchOf([["a", 1]]));
    expect(xOf(rebase(synced(), dropped, start(), new Set()), "a")).toBe(0);
  });

  it("keeps a held element where the local gesture has it", () => {
    const server = synced(content([entry("a", 80, "a0"), entry("b", 0, "a1")]));
    const next = rebase(server, EMPTY_PENDING, start(), new Set(["a"]));
    expect(xOf(next, "a")).toBe(0);
  });

  it("returns the same pages when the server echoes them back", () => {
    const current = start();
    // Fresh objects with the same content, like rows decoded from Postgres
    const echoed = synced(
      content(
        [entry("a", 0, "a0"), entry("b", 0, "a1")],
        [["p1", page("a0", { ...background })]]
      )
    );
    expect(rebase(echoed, EMPTY_PENDING, current, new Set())).toBe(current);
  });

  it("rebuilds only the page whose content changed", () => {
    const two = content(
      [entry("a", 0, "a0"), entry("c", 0, "a0", "p2")],
      [
        ["p1", page("a0")],
        ["p2", page("a1")],
      ]
    );
    const current = composePages(two, []);
    const server = synced({
      ...two,
      elements: new Map([...two.elements, ["c", entry("c", 40, "a0", "p2")]]),
    });
    const next = rebase(server, EMPTY_PENDING, current, new Set());
    expect(next[0]).toBe(current[0]);
    expect(next[1]).not.toBe(current[1]);
    expect(xOf(next, "c")).toBe(40);
  });

  it("orders elements by their keys", () => {
    const server = synced(content([entry("a", 0, "a5"), entry("b", 0, "a1")]));
    expect(ids(rebase(server, EMPTY_PENDING, start(), new Set())[0])).toEqual([
      "b",
      "a",
    ]);
  });
});
