import { describe, expect, it } from "vitest";

import {
  createBoxElement,
  createDocument,
  createImageElement,
  createLinearElement,
  createTextElement,
} from "@/lib/document/factories";
import { migrateDocument } from "@/lib/document/migrate";
import { designDocumentSchema } from "@/lib/document/schema";

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

  it("rejects unknown element types", () => {
    const document = {
      ...createDocument(PAGE),
      elements: [{ id: "x", type: "video" }],
    };
    expect(() => designDocumentSchema.parse(document)).toThrow();
  });
});

describe("migrateDocument", () => {
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
