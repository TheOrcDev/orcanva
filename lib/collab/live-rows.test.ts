import { describe, expect, it } from "vitest";

import { entriesFromRows, pageFromRow } from "@/lib/collab/live-rows";
import { createBoxElement } from "@/lib/document/factories";

const PAGE = { height: 720, width: 1280 };
const rect = { ...createBoxElement("rect", PAGE), id: "r1" };

describe("entriesFromRows", () => {
  it("validates rows into entries", () => {
    const entries = entriesFromRows(
      [{ data: rect, id: "r1", position: "a0" }],
      new Map()
    );
    expect(entries.get("r1")).toEqual({ element: rect, position: "a0" });
  });

  it("keeps the previous entry when a row comes back unchanged", () => {
    const known = { element: rect, position: "a0" };
    const entries = entriesFromRows(
      // A decoded copy, as if echoed back from Postgres
      [{ data: structuredClone(rect), id: "r1", position: "a0" }],
      new Map([["r1", known]])
    );
    expect(entries.get("r1")).toBe(known);
  });

  it("skips rows that don't validate or don't match their id", () => {
    const entries = entriesFromRows(
      [
        { data: { id: "bad" }, id: "bad", position: "a0" },
        { data: rect, id: "other", position: "a1" },
      ],
      new Map()
    );
    expect(entries.size).toBe(0);
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
        width: 200,
      })
    ).toBeNull();
  });
});
