import { describe, expect, it } from "vitest";

import { createBoxElement } from "@/lib/document/factories";
import { DOCUMENT_VERSION } from "@/lib/document/schema";
import { versionDocument } from "@/lib/versions/content";
import type { VersionContent } from "@/lib/versions/content";

const PAGE = { height: 720, width: 1280 };
const rect = (id: string) => ({ ...createBoxElement("rect", PAGE), id });

const content = (elements: VersionContent["elements"]): VersionContent => ({
  assetIds: [],
  background: { color: "#123456", type: "solid" },
  docVersion: DOCUMENT_VERSION,
  elements,
  height: PAGE.height,
  pages: null,
  width: PAGE.width,
});

const entry = (
  id: string,
  position: string,
  data: unknown = rect(id),
  pageId: string | null = null
) => ({
  data,
  id,
  pageId,
  position,
});

const firstPage = (built: ReturnType<typeof versionDocument>) => {
  const [page] = built.pages;
  if (!page) {
    throw new Error("No page");
  }
  return page;
};

describe("versionDocument", () => {
  it("draws the page as stored", () => {
    const { document } = firstPage(versionDocument(content([])));
    expect(document).toEqual({
      background: { color: "#123456", type: "solid" },
      elements: [],
      height: 720,
      version: DOCUMENT_VERSION,
      width: 1280,
    });
  });

  it("orders elements by position, then id, whatever order they're stored in", () => {
    const { document, positions } = firstPage(
      versionDocument(
        content([
          entry("top", "a2"),
          entry("b", "a1"),
          entry("bottom", "a0"),
          entry("a", "a1"),
        ])
      )
    );
    expect(document.elements.map((element) => element.id)).toEqual([
      "bottom",
      "a",
      "b",
      "top",
    ]);
    expect(positions).toEqual({ a: "a1", b: "a1", bottom: "a0", top: "a2" });
  });

  it("skips rows that don't validate or don't match their id, and lists them", () => {
    const built = versionDocument(
      content([
        entry("ok", "a0"),
        entry("hologram", "a1", { ...rect("hologram"), type: "hologram" }),
        entry("broken", "a2", { id: "broken" }),
        entry("mismatch", "a3", rect("other")),
        entry("null", "a4", null),
      ])
    );
    const { document, positions } = firstPage(built);
    const { skipped } = built;
    expect(document.elements.map((element) => element.id)).toEqual(["ok"]);
    expect(Object.keys(positions)).toEqual(["ok"]);
    expect(skipped).toEqual(["hologram", "broken", "mismatch", "null"]);
  });

  it("keeps fields newer code added to elements it knows", () => {
    const newer = { ...rect("r1"), futureField: { kept: true } };
    const { document } = firstPage(
      versionDocument(content([entry("r1", "a0", newer)]))
    );
    expect(document.elements[0]).toEqual(newer);
  });

  it("refuses a version from a newer document version", () => {
    expect(() =>
      versionDocument({ ...content([]), docVersion: DOCUMENT_VERSION + 1 })
    ).toThrow(/newer/u);
  });

  it("draws every page in order, each with its own background and elements", () => {
    const built = versionDocument({
      ...content([
        entry("one", "a0", rect("one"), "p1"),
        entry("two", "a0", rect("two"), "p2"),
        entry("lost", "a1", rect("lost"), "gone"),
        entry("legacy", "a2", rect("legacy"), null),
      ]),
      pages: [
        {
          background: { color: "#222222", type: "solid" },
          id: "p2",
          position: "a1",
        },
        {
          background: { color: "#111111", type: "solid" },
          id: "p1",
          position: "a0",
        },
      ],
    });
    expect(built.pages.map((page) => page.id)).toEqual(["p1", "p2"]);
    const [first, second] = built.pages;
    expect(first?.document.background).toEqual({
      color: "#111111",
      type: "solid",
    });
    // Elements on a page it doesn't list, or on none, are on the first
    expect(first?.document.elements.map((element) => element.id)).toEqual([
      "one",
      "lost",
      "legacy",
    ]);
    expect(second?.document.elements.map((element) => element.id)).toEqual([
      "two",
    ]);
    expect(built.skipped).toEqual([]);
  });

  it("holds one page for a version from before pages", () => {
    const built = versionDocument(
      content([
        entry("a", "a0", rect("a"), null),
        entry("b", "a1", rect("b"), "x"),
      ])
    );
    expect(built.pages).toHaveLength(1);
    expect(firstPage(built).id).toBeNull();
    expect(firstPage(built).document.elements).toHaveLength(2);
  });
});
