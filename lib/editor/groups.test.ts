import { describe, expect, it } from "vitest";

import { createBoxElement, createDocument } from "@/lib/document/factories";
import type { DesignDocument } from "@/lib/document/schema";
import { duplicateElements } from "@/lib/editor/document-ops";
import {
  expandToGroups,
  groupElements,
  regroupCopies,
  selectedGroup,
  selectionUnits,
  ungroupElements,
  unitOf,
} from "@/lib/editor/groups";

const PAGE = { height: 720, width: 1280 };

const element = (id: string, groupId: string | null = null) => ({
  ...createBoxElement("rect", PAGE),
  groupId,
  id,
});

const documentOf = (
  ...elements: ReturnType<typeof element>[]
): DesignDocument => ({
  ...createDocument(PAGE),
  elements,
});

const ids = (document: DesignDocument) =>
  document.elements.map((item) => item.id);

describe("groups", () => {
  const document = documentOf(
    element("a", "g"),
    element("b"),
    element("c", "g"),
    element("d", "lonely")
  );

  it("selects a whole group, and an element left alone by itself", () => {
    expect(unitOf(document, "a")).toEqual(["a", "c"]);
    expect(unitOf(document, "d")).toEqual(["d"]);
    expect(expandToGroups(document, ["c", "b"])).toEqual(["a", "b", "c"]);
  });

  it("splits a selection into groups and single elements", () => {
    expect(selectionUnits(document, ["a", "b", "c", "d"])).toEqual([
      ["a", "c"],
      ["b"],
      ["d"],
    ]);
    expect(selectedGroup(document, ["a", "c"])).toBe("g");
    expect(selectedGroup(document, ["a", "b", "c"])).toBeNull();
  });

  it("groups elements together at the topmost one's place", () => {
    const grouped = groupElements(
      documentOf(element("a"), element("b"), element("c")),
      ["a", "c"],
      "new"
    );
    expect(ids(grouped)).toEqual(["b", "a", "c"]);
    expect(grouped.elements.map((item) => item.groupId)).toEqual([
      null,
      "new",
      "new",
    ]);
  });

  it("merges groups when grouping them", () => {
    const merged = groupElements(document, ["a", "b"], "big");
    expect(
      merged.elements
        .filter((item) => item.groupId === "big")
        .map((item) => item.id)
    ).toEqual(["a", "b", "c"]);
  });

  it("ungroups every member", () => {
    const ungrouped = ungroupElements(document, ["c"]);
    expect(ungrouped.elements.map((item) => item.groupId)).toEqual([
      null,
      null,
      null,
      "lonely",
    ]);
  });

  it("gives copies new groups, and drops a group with one copy", () => {
    const copies = regroupCopies([
      element("a", "g"),
      element("c", "g"),
      element("x", "h"),
    ]);
    const [first, second, third] = copies;
    expect(first?.groupId).not.toBe("g");
    expect(first?.groupId).toBe(second?.groupId);
    expect(third?.groupId).toBeNull();
  });

  it("duplicates a group as one block above it", () => {
    const result = duplicateElements(document, ["a", "c"]);
    expect(ids(result.document).slice(0, 3)).toEqual(["a", "b", "c"]);
    expect(result.document.elements).toHaveLength(6);
    const copies = result.document.elements.slice(3, 5);
    expect(copies.map((item) => item.id)).toEqual(result.ids);
    expect(copies[0]?.groupId).toBe(copies[1]?.groupId);
  });
});
