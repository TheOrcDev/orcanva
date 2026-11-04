import { describe, expect, it } from "vitest";

import { elementData, resizedCopyInput } from "@/lib/document/element-input";
import { createBoxElement, createDocument } from "@/lib/document/factories";
import { MAX_ELEMENTS, MAX_ELEMENT_JSON_LENGTH } from "@/lib/document/schema";

const PAGE = { height: 1920, width: 1080 };
const rect = createBoxElement("rect", PAGE);
const copy = (overrides: Record<string, unknown> = {}) => ({
  background: createDocument(PAGE).background,
  elements: [{ data: rect, position: "a0" }],
  height: PAGE.height,
  name: "Launch · Story / Shorts",
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
    expect(parsed.elements[0]?.data).toEqual(rect);
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
        copy({ elements: [{ data: rect, position: "a 0" }] })
      ).success
    ).toBe(false);
    // Ids are the rows' keys within the design
    expect(
      resizedCopyInput.safeParse(
        copy({
          elements: [
            { data: rect, position: "a0" },
            { data: rect, position: "a1" },
          ],
        })
      ).success
    ).toBe(false);
    const many = Array.from({ length: MAX_ELEMENTS + 1 }, (_, index) => ({
      data: { ...rect, id: `e${index}` },
      position: `a${index}`,
    }));
    expect(resizedCopyInput.safeParse(copy({ elements: many })).success).toBe(
      false
    );
  });
});
