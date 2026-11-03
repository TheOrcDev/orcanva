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
  width: PAGE.width,
});

const entry = (id: string, position: string, data: unknown = rect(id)) => ({
  data,
  id,
  pageId: null,
  position,
});

describe("versionDocument", () => {
  it("draws the page as stored", () => {
    const { document } = versionDocument(content([]));
    expect(document).toEqual({
      background: { color: "#123456", type: "solid" },
      elements: [],
      height: 720,
      version: DOCUMENT_VERSION,
      width: 1280,
    });
  });

  it("orders elements by position, then id, whatever order they're stored in", () => {
    const { document, positions } = versionDocument(
      content([
        entry("top", "a2"),
        entry("b", "a1"),
        entry("bottom", "a0"),
        entry("a", "a1"),
      ])
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
    const { document, positions, skipped } = versionDocument(
      content([
        entry("ok", "a0"),
        entry("hologram", "a1", { ...rect("hologram"), type: "hologram" }),
        entry("broken", "a2", { id: "broken" }),
        entry("mismatch", "a3", rect("other")),
        entry("null", "a4", null),
      ])
    );
    expect(document.elements.map((element) => element.id)).toEqual(["ok"]);
    expect(Object.keys(positions)).toEqual(["ok"]);
    expect(skipped).toEqual(["hologram", "broken", "mismatch", "null"]);
  });

  it("keeps fields newer code added to elements it knows", () => {
    const newer = { ...rect("r1"), futureField: { kept: true } };
    const { document } = versionDocument(content([entry("r1", "a0", newer)]));
    expect(document.elements[0]).toEqual(newer);
  });

  it("refuses a version from a newer document version", () => {
    expect(() =>
      versionDocument({ ...content([]), docVersion: DOCUMENT_VERSION + 1 })
    ).toThrow(/newer/u);
  });
});
