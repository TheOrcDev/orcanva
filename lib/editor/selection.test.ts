import { describe, expect, it } from "vitest";

import { createBoxElement, createDocument } from "@/lib/document/factories";
import {
  boxSelection,
  editableSelection,
  rectFromCorners,
  selectableIds,
  toggleSelected,
} from "@/lib/editor/selection";

const PAGE = { height: 720, width: 1280 };

describe("selection", () => {
  it("toggles an element in and out", () => {
    expect(toggleSelected(["a"], "b")).toEqual(["a", "b"]);
    expect(toggleSelected(["a", "b"], "a")).toEqual(["b"]);
  });

  it("selects all visible, unlocked elements", () => {
    const document = createDocument(PAGE);
    const shown = { ...createBoxElement("rect", PAGE), id: "shown" };
    const hidden = { ...shown, id: "hidden", visible: false };
    const locked = { ...shown, id: "locked", locked: true };
    document.elements.push(shown, hidden, locked);
    expect(selectableIds(document)).toEqual(["shown"]);
    expect(
      editableSelection(document, ["locked", "shown"]).map(
        (element) => element.id
      )
    ).toEqual(["shown"]);
  });

  it("picks what a selection box touches, keeping the earlier selection", () => {
    const boxes = new Map([
      ["a", { height: 10, width: 10, x: 0, y: 0 }],
      ["b", { height: 10, width: 10, x: 50, y: 50 }],
      ["c", { height: 10, width: 10, x: 200, y: 200 }],
    ]);
    const area = rectFromCorners({ x: 55, y: 55 }, { x: 5, y: 5 });
    expect(area).toEqual({ height: 50, width: 50, x: 5, y: 5 });
    expect(boxSelection([], boxes, area)).toEqual(["a", "b"]);
    expect(boxSelection(["c"], boxes, area)).toEqual(["c", "a", "b"]);
  });
});
