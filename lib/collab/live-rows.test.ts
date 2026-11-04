import { describe, expect, it } from "vitest";

import {
  entriesFromRows,
  isNewerDocument,
  pageFromRow,
  pagesFromRows,
  restoreFromRow,
} from "@/lib/collab/live-rows";
import { createBoxElement } from "@/lib/document/factories";
import { DOCUMENT_VERSION } from "@/lib/document/schema";

const PAGE = { height: 720, width: 1280 };
const rect = { ...createBoxElement("rect", PAGE), id: "r1" };

describe("entriesFromRows", () => {
  it("validates rows into entries", () => {
    const { entries, skipped } = entriesFromRows(
      [{ data: rect, id: "r1", position: "a0" }],
      new Map(),
      "first"
    );
    expect(entries.get("r1")).toEqual({
      element: rect,
      pageId: "first",
      position: "a0",
    });
    expect(skipped).toEqual([]);
  });

  it("keeps fields newer code added", () => {
    const newer = { ...rect, futureField: { kept: true } };
    const { entries } = entriesFromRows(
      [{ data: newer, id: "r1", position: "a0" }],
      new Map(),
      "first"
    );
    expect(entries.get("r1")?.element).toEqual(newer);
  });

  it("keeps the previous entry when a row comes back unchanged", () => {
    const known = { element: rect, pageId: "first", position: "a0" };
    const { entries } = entriesFromRows(
      // A decoded copy, as if echoed back from Postgres
      [{ data: structuredClone(rect), id: "r1", position: "a0" }],
      new Map([["r1", known]]),
      "first"
    );
    expect(entries.get("r1")).toBe(known);
  });

  it("skips rows that don't validate or don't match their id, and lists them", () => {
    const { entries, skipped } = entriesFromRows(
      [
        { data: { id: "bad" }, id: "bad", position: "a0" },
        { data: rect, id: "other", position: "a1" },
      ],
      new Map(),
      "first"
    );
    expect(entries.size).toBe(0);
    expect(skipped).toEqual(["bad", "other"]);
  });

  it("keeps the elements it knows next to a type from a newer Orcanva", () => {
    const sticker = { ...rect, id: "g1", type: "hologram" };
    const { entries, skipped } = entriesFromRows(
      [
        { data: rect, id: "r1", position: "a0" },
        { data: sticker, id: "g1", position: "a1" },
      ],
      new Map(),
      "first"
    );
    expect([...entries.keys()]).toEqual(["r1"]);
    expect(skipped).toEqual(["g1"]);
  });
});

describe("entriesFromRows pages", () => {
  it("reads each row's page, and puts a row without one on the first", () => {
    const { entries } = entriesFromRows(
      [
        { data: rect, id: "r1", page_id: "p2", position: "a0" },
        {
          data: { ...rect, id: "r2" },
          id: "r2",
          page_id: null,
          position: "a1",
        },
      ],
      new Map(),
      "p1"
    );
    expect(entries.get("r1")?.pageId).toBe("p2");
    expect(entries.get("r2")?.pageId).toBe("p1");
  });

  it("makes a new entry when an element moves to another page", () => {
    const known = { element: rect, pageId: "p1", position: "a0" };
    const { entries } = entriesFromRows(
      [{ data: rect, id: "r1", page_id: "p2", position: "a0" }],
      new Map([["r1", known]]),
      "p1"
    );
    expect(entries.get("r1")).not.toBe(known);
    expect(entries.get("r1")?.pageId).toBe("p2");
  });
});

describe("pagesFromRows", () => {
  const blue = { color: "#0000ff", type: "solid" } as const;
  const white = { color: "#ffffff", type: "solid" } as const;

  it("reads pages, keeping unchanged ones as they were", () => {
    const known = { background: blue, position: "a0" };
    const pages = pagesFromRows(
      [
        { background: { ...blue }, id: "p1", position: "a0" },
        { background: white, id: "p2", position: "a1" },
      ],
      new Map([["p1", known]]),
      white
    );
    expect(pages.get("p1")).toBe(known);
    expect(pages.get("p2")).toEqual({ background: white, position: "a1" });
  });

  it("shows a background it can't read as the fallback, keeping the page", () => {
    const pages = pagesFromRows(
      [{ background: { type: "hologram" }, id: "p1", position: "a0" }],
      new Map(),
      white
    );
    expect(pages.get("p1")).toEqual({ background: white, position: "a0" });
  });
});

describe("isNewerDocument", () => {
  const row = {
    background: { color: "#000000", type: "solid" },
    height: 100,
    name: "Thumb",
    visibility: "public",
    width: 200,
  };

  it("is true only for a version past this tab's", () => {
    expect(isNewerDocument({ ...row, version: DOCUMENT_VERSION })).toBe(false);
    expect(isNewerDocument({ ...row, version: DOCUMENT_VERSION - 1 })).toBe(
      false
    );
    expect(isNewerDocument({ ...row, version: DOCUMENT_VERSION + 1 })).toBe(
      true
    );
  });
});

describe("pageFromRow", () => {
  it("reads page settings and the name", () => {
    expect(
      pageFromRow({
        background: { color: "#000000", type: "solid" },
        height: 100,
        name: "Thumb",
        version: 1,
        visibility: "public",
        width: 200,
      })
    ).toEqual({
      background: { color: "#000000", type: "solid" },
      name: "Thumb",
      size: { height: 100, width: 200 },
    });
  });

  it("reads the size and name of a row without a valid background", () => {
    expect(
      pageFromRow({
        background: null,
        height: 100,
        name: "Thumb",
        version: 1,
        visibility: "public",
        width: 200,
      })
    ).toEqual({
      background: null,
      name: "Thumb",
      size: { height: 100, width: 200 },
    });
  });
});

describe("restoreFromRow", () => {
  const row = {
    background: { color: "#000000", type: "solid" },
    height: 100,
    name: "Thumb",
    version: 1,
    visibility: "public",
    width: 200,
  };

  it("reads which restore the design is at, and who made it", () => {
    expect(
      restoreFromRow({ ...row, restore_seq: 3, restored_by_name: "Jay" })
    ).toEqual({ byName: "Jay", seq: 3 });
    expect(
      restoreFromRow({ ...row, restore_seq: 0, restored_by_name: null })
    ).toEqual({ byName: null, seq: 0 });
  });

  it("says nothing for a row sealed before version history", () => {
    expect(restoreFromRow(row)).toBeNull();
    expect(
      restoreFromRow({ ...row, restore_seq: Number.NaN, restored_by_name: "x" })
    ).toBeNull();
  });
});
