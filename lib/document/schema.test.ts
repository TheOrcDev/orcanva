import { describe, expect, it } from "vitest";

import {
  createBoxElement,
  createDocument,
  createImageElement,
  createLinearElement,
  createTextElement,
} from "@/lib/document/factories";
import { migrateDocument } from "@/lib/document/migrate";
import {
  designDocumentSchema,
  elementSchema,
  parseElement,
} from "@/lib/document/schema";

const PAGE = { height: 720, width: 1280 };
const ASSET = {
  height: 600,
  id: "8a5b3f4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
  width: 800,
};

describe("design document schema", () => {
  it("accepts a document built from every factory", () => {
    const document = createDocument(PAGE);
    document.elements.push(
      createImageElement(ASSET, PAGE),
      createTextElement("heading", PAGE),
      createTextElement("outlined", PAGE),
      createTextElement("label", PAGE),
      createTextElement("shadow", PAGE),
      createBoxElement("rect", PAGE),
      createBoxElement("ellipse", PAGE),
      createLinearElement("line", PAGE),
      createLinearElement("arrow", PAGE)
    );

    expect(designDocumentSchema.parse(document)).toEqual(document);
  });

  it("rejects canvas sizes outside the supported range", () => {
    expect(() =>
      designDocumentSchema.parse(createDocument({ height: 720, width: 5000 }))
    ).toThrow();
    expect(() =>
      designDocumentSchema.parse(createDocument({ height: 8, width: 1280 }))
    ).toThrow();
  });

  it("reads images saved before filters existed as unfiltered", () => {
    const { filter, ...saved } = createImageElement(ASSET, PAGE);
    expect(filter).toBeNull();
    expect(elementSchema.parse(saved)).toEqual({ ...saved, filter: null });
  });

  it("fills in sliders a filter was saved without and keeps unknown presets", () => {
    const image = {
      ...createImageElement(ASSET, PAGE),
      filter: { adjust: { contrast: 20 }, preset: "newer-look", strength: 60 },
    };
    const parsed = elementSchema.parse(image);
    expect(parsed.type === "image" && parsed.filter).toMatchObject({
      adjust: { brightness: 0, contrast: 20, vignette: 0 },
      preset: "newer-look",
      strength: 60,
    });
  });

  it("rejects filter values outside their range", () => {
    const image = createImageElement(ASSET, PAGE);
    const withFilter = (adjust: Record<string, number>) => ({
      ...image,
      filter: { adjust, preset: null, strength: 100 },
    });
    expect(() =>
      elementSchema.parse(withFilter({ brightness: 101 }))
    ).toThrow();
    expect(() => elementSchema.parse(withFilter({ vignette: -1 }))).toThrow();
  });

  it("rejects unknown element types", () => {
    const document = {
      ...createDocument(PAGE),
      elements: [{ id: "x", type: "video" }],
    };
    expect(() => designDocumentSchema.parse(document)).toThrow();
  });
});

describe("parseElement", () => {
  it("keeps top-level fields newer code added", () => {
    const rect = { ...createBoxElement("rect", PAGE), futureField: [1, 2] };
    expect(parseElement(rect)).toEqual(rect);
  });

  it("still validates the fields it knows", () => {
    expect(
      parseElement({ ...createBoxElement("rect", PAGE), opacity: 2 })
    ).toBeNull();
    expect(parseElement("rect")).toBeNull();
  });
});

describe("migrateDocument", () => {
  it("keeps fields newer code added to elements", () => {
    const rect = { ...createBoxElement("rect", PAGE), futureField: "kept" };
    const document = { ...createDocument(PAGE), elements: [rect] };
    expect(migrateDocument(document).elements).toEqual([rect]);
  });

  it("returns a valid current-version document unchanged", () => {
    const document = createDocument(PAGE);
    expect(migrateDocument(document)).toEqual(document);
  });

  it("rejects non-objects and future versions", () => {
    expect(() => migrateDocument(null)).toThrow("must be an object");
    expect(() =>
      migrateDocument({ ...createDocument(PAGE), version: 99 })
    ).toThrow("newer than supported");
  });
});
