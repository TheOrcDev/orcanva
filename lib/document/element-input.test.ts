import { describe, expect, it } from "vitest";

import { elementData, resizedCopyInput } from "@/lib/document/element-input";
import { createBoxElement, createDocument } from "@/lib/document/factories";
import {
  MAX_ELEMENTS,
  MAX_ELEMENT_JSON_LENGTH,
  MAX_PAGES,
} from "@/lib/document/schema";

const PAGE = { height: 1920, width: 1080 };
const rect = createBoxElement("rect", PAGE);
const page = (
  id: string,
  elements: unknown[] = [{ data: rect, position: "a0" }]
) => ({
  background: createDocument(PAGE).background,
  elements,
  id,
  position: "a0",
});
const copy = (overrides: Record<string, unknown> = {}) => ({
  height: PAGE.height,
  name: "Launch · Story / Shorts",
  pages: [page("p1")],
  sourceId: "8a5b3f4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
  width: PAGE.width,
  ...overrides,
});

describe("element input", () => {
  it("keeps fields this version doesn't know", () => {
    const parsed = elementData.parse({ ...rect, sparkle: { level: 3 } });
    expect(parsed).toMatchObject({ id: rect.id, sparkle: { level: 3 } });
  });

  it("refuses elements over 64 KB, and ones that don't validate", () => {
    const long = {
      ...rect,
      name: "x".repeat(120),
      padding: "x".repeat(MAX_ELEMENT_JSON_LENGTH),
    };
    expect(elementData.safeParse(long).success).toBe(false);
    expect(elementData.safeParse({ ...rect, width: -1 }).success).toBe(false);
  });

  it("takes a whole resized copy", () => {
    const parsed = resizedCopyInput.parse(copy());
    expect(parsed.pages[0]?.elements[0]?.data).toEqual(rect);
    expect(parsed.name).toBe("Launch · Story / Shorts");
  });

  it("refuses a copy with bad sizes, keys, ids or too many elements", () => {
    expect(resizedCopyInput.safeParse(copy({ width: 8 })).success).toBe(false);
    expect(resizedCopyInput.safeParse(copy({ name: " " })).success).toBe(false);
    expect(resizedCopyInput.safeParse(copy({ sourceId: "abc" })).success).toBe(
      false
    );
    expect(
      resizedCopyInput.safeParse(
        copy({ pages: [page("p1", [{ data: rect, position: "a 0" }])] })
      ).success
    ).toBe(false);
    // Ids are the rows' keys within the design, whatever page they're on
    expect(
      resizedCopyInput.safeParse(copy({ pages: [page("p1"), page("p2")] }))
        .success
    ).toBe(false);
    expect(
      resizedCopyInput.safeParse(copy({ pages: [page("p1"), page("p1", [])] }))
        .success
    ).toBe(false);
    // At most MAX_ELEMENTS across the pages, and MAX_PAGES pages
    const half = (from: number) =>
      Array.from({ length: MAX_ELEMENTS / 2 + 1 }, (_, index) => ({
        data: { ...rect, id: `e${from + index}` },
        position: `a${index}`,
      }));
    expect(
      resizedCopyInput.safeParse(
        copy({ pages: [page("p1", half(0)), page("p2", half(1000))] })
      ).success
    ).toBe(false);
    expect(
      resizedCopyInput.safeParse(
        copy({
          pages: Array.from({ length: MAX_PAGES + 1 }, (_, index) =>
            page(`p${index}`, [])
          ),
        })
      ).success
    ).toBe(false);
    expect(resizedCopyInput.safeParse(copy({ pages: [] })).success).toBe(false);
  });
});
