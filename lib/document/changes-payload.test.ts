import { describe, expect, it } from "vitest";

import {
  changesPayload,
  changesWritesOf,
} from "@/lib/document/changes-payload";
import { createBoxElement } from "@/lib/document/factories";
import { MAX_PAGES } from "@/lib/document/schema";

const PAGE = { height: 720, width: 1280 };
const CLIENT = "6d3f1d2a-7c1e-4a8e-9a37-0b8f6f1c2d3e";
const rect = { ...createBoxElement("rect", PAGE), id: "r1" };
const blue = { color: "#0000ff", type: "solid" } as const;

describe("changesPayload", () => {
  it("reads a tab from before pages: its page is the size and the first page's background", () => {
    const parsed = changesPayload.parse({
      clientId: CLIENT,
      deletes: ["gone"],
      elements: [{ data: rect, mode: "update", position: "a0" }],
      page: { background: blue, height: 1080, width: 1920 },
    });
    expect(changesWritesOf(parsed)).toEqual({
      deletes: ["gone"],
      firstPageBackground: blue,
      name: null,
      pageDeletes: [],
      pages: [],
      size: { height: 1080, width: 1920 },
      writes: [{ data: rect, mode: "update", pageId: null, position: "a0" }],
    });
  });

  it("reads pages, page deletes, the size and each element's page", () => {
    const parsed = changesPayload.parse({
      clientId: CLIENT,
      deletes: [],
      elements: [{ data: rect, mode: "create", pageId: "p2", position: "a0" }],
      name: "Carousel",
      pageDeletes: ["p3"],
      pages: [{ background: blue, id: "p2", mode: "create", position: "a1" }],
      size: { height: 1350, width: 1080 },
    });
    expect(changesWritesOf(parsed)).toEqual({
      deletes: [],
      firstPageBackground: null,
      name: "Carousel",
      pageDeletes: ["p3"],
      pages: [{ background: blue, id: "p2", mode: "create", position: "a1" }],
      size: { height: 1350, width: 1080 },
      writes: [{ data: rect, mode: "create", pageId: "p2", position: "a0" }],
    });
  });

  it("refuses the same page twice, bad page ids and too many pages", () => {
    const base = { clientId: CLIENT, deletes: [], elements: [] };
    const page = { background: blue, id: "p", mode: "update", position: "a0" };
    expect(
      changesPayload.safeParse({ ...base, pages: [page, page] }).success
    ).toBe(false);
    expect(
      changesPayload.safeParse({ ...base, pages: [{ ...page, id: "" }] })
        .success
    ).toBe(false);
    expect(
      changesPayload.safeParse({ ...base, pageDeletes: ["x".repeat(65)] })
        .success
    ).toBe(false);
    expect(
      changesPayload.safeParse({
        ...base,
        pages: Array.from({ length: MAX_PAGES * 2 + 1 }, (_, index) => ({
          ...page,
          id: `p${index}`,
        })),
      }).success
    ).toBe(false);
    expect(
      changesPayload.safeParse({
        ...base,
        elements: [{ data: rect, mode: "update", pageId: "", position: "a0" }],
      }).success
    ).toBe(false);
  });

  it("refuses a size outside the canvas limits", () => {
    expect(
      changesPayload.safeParse({
        clientId: CLIENT,
        deletes: [],
        elements: [],
        size: { height: 10, width: 1280 },
      }).success
    ).toBe(false);
  });
});
