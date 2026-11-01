import { describe, expect, it } from "vitest";

import { createBoxElement, createDocument } from "@/lib/document/factories";
import type { DesignDocument } from "@/lib/document/schema";
import { reorderElements } from "@/lib/editor/document-ops";
import {
  flattenLayers,
  layerItems,
  layerKey,
  moveLayer,
} from "@/lib/editor/layers";

const PAGE = { height: 720, width: 1280 };

const element = (id: string, groupId: string | null = null) => ({
  ...createBoxElement("rect", PAGE),
  groupId,
  id,
});

// Bottom to top: a, b (group g), c, d (group g)
const document: DesignDocument = {
  ...createDocument(PAGE),
  elements: [element("a"), element("b", "g"), element("c"), element("d", "g")],
};

describe("layers", () => {
  it("lists a group at its topmost member, with all its members", () => {
    const items = layerItems(document);
    expect(items.map(layerKey)).toEqual(["group:g", "c", "a"]);
    const [group] = items;
    expect(
      group?.kind === "group" && group.members.map((member) => member.id)
    ).toEqual(["d", "b"]);
  });

  it("moves a group as one block, making it whole again", () => {
    const moved = moveLayer(layerItems(document), "group:g", "a");
    expect(moved && flattenLayers(moved)).toEqual(["b", "d", "a", "c"]);
  });

  it("takes a drop on a member as a drop on its group", () => {
    const moved = moveLayer(layerItems(document), "a", "d");
    expect(moved && flattenLayers(moved)).toEqual(["c", "b", "d", "a"]);
    expect(moveLayer(layerItems(document), "group:g", "b")).toBeNull();
  });

  it("reorders members only within their group", () => {
    const items = layerItems(document);
    const moved = moveLayer(items, "b", "d");
    // b goes above d, and the group is whole again where it was on top
    expect(moved && flattenLayers(moved)).toEqual(["a", "c", "d", "b"]);
    expect(moveLayer(items, "b", "c")).toBeNull();
  });

  it("puts a document in a given order", () => {
    expect(
      reorderElements(document, ["d", "c", "b", "a"]).elements.map(
        (item) => item.id
      )
    ).toEqual(["d", "c", "b", "a"]);
    expect(reorderElements(document, ["a", "b", "c", "d"])).toBe(document);
  });
});
