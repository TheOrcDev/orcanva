import { describe, expect, it } from "vitest";

import { entriesFromRows, pageFromRow } from "@/lib/collab/live-rows";
import { createBoxElement } from "@/lib/document/factories";

const PAGE = { height: 720, width: 1280 };
const rect = { ...createBoxElement("rect", PAGE), id: "r1" };

describe("entriesFromRows", () => {
  it("validates rows into entries", () => {
    const { entries, skipped } = entriesFromRows(
      [{ data: rect, id: "r1", position: "a0" }],
      new Map()
    );
    expect(entries.get("r1")).toEqual({ element: rect, position: "a0" });
    expect(skipped).toEqual([]);
  });

  it("keeps fields newer code added", () => {
    const newer = { ...rect, futureField: { kept: true } };
    const { entries } = entriesFromRows(
      [{ data: newer, id: "r1", position: "a0" }],
      new Map()
    );
    expect(entries.get("r1")?.element).toEqual(newer);
  });

  it("keeps the previous entry when a row comes back unchanged", () => {
    const known = { element: rect, position: "a0" };
    const { entries } = entriesFromRows(
      // A decoded copy, as if echoed back from Postgres
      [{ data: structuredClone(rect), id: "r1", position: "a0" }],
      new Map([["r1", known]])
    );
    expect(entries.get("r1")).toBe(known);
  });

  it("skips rows that don't validate or don't match their id, and lists them", () => {
    const { entries, skipped } = entriesFromRows(
      [
        { data: { id: "bad" }, id: "bad", position: "a0" },
        { data: rect, id: "other", position: "a1" },
      ],
      new Map()
    );
    expect(entries.size).toBe(0);
    expect(skipped).toEqual(["bad", "other"]);
  });

  it("keeps the elements it knows next to a type from a newer Orcanva", () => {
    const sticker = { ...rect, id: "g1", type: "graphic" };
    const { entries, skipped } = entriesFromRows(
      [
        { data: rect, id: "r1", position: "a0" },
        { data: sticker, id: "g1", position: "a1" },
      ],
      new Map()
    );
    expect([...entries.keys()]).toEqual(["r1"]);
    expect(skipped).toEqual(["g1"]);
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
      name: "Thumb",
      page: {
        background: { color: "#000000", type: "solid" },
        height: 100,
        width: 200,
      },
    });
  });

  it("ignores a row with an invalid background", () => {
    expect(
      pageFromRow({
        background: null,
        height: 100,
        name: "Thumb",
        version: 1,
        visibility: "public",
        width: 200,
      })
    ).toBeNull();
  });
});
