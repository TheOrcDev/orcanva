import { describe, expect, it } from "vitest";

import { firstPageIdOf, resolvePageId, sortPages } from "@/lib/document/pages";

describe("resolvePageId", () => {
  it("takes the page a write names", () => {
    expect(resolvePageId("p2", "p1", "first")).toBe("p2");
  });

  it("leaves an element on its page when a write names none", () => {
    expect(resolvePageId(null, "p1", "first")).toBe("p1");
    expect(resolvePageId(undefined, "p1", "first")).toBe("p1");
  });

  it("puts a new element from a tab from before pages on the first page", () => {
    expect(resolvePageId(null, null, "first")).toBe("first");
  });
});

describe("pages", () => {
  it("gives a design's first page the design's id", () => {
    expect(firstPageIdOf("d1")).toBe("d1");
  });

  it("sorts pages by position, then id", () => {
    expect(
      sortPages([
        { id: "c", position: "a1" },
        { id: "b", position: "a0" },
        { id: "a", position: "a1" },
      ]).map((page) => page.id)
    ).toEqual(["b", "a", "c"]);
  });
});
