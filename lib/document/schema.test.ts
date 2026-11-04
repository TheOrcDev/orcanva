import { describe, expect, it } from "vitest";

import {
  createBoxElement,
  createDocument,
  createFrameElement,
  createGraphicElement,
  createImageElement,
  createLinearElement,
  createTextElement,
} from "@/lib/document/factories";
import { migrateDocument } from "@/lib/document/migrate";
import {
  DOCUMENT_VERSION,
  designDocumentSchema,
  elementSchema,
  parseElement,
} from "@/lib/document/schema";
import { BUILTIN_GRAPHICS } from "@/lib/graphics/builtin";

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
      createLinearElement("arrow", PAGE),
      ...BUILTIN_GRAPHICS.map((graphic) => createGraphicElement(graphic, PAGE))
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

  it("reads photos saved before effects existed as having none", () => {
    for (const photo of [
      createImageElement(ASSET, PAGE),
      createFrameElement(PAGE),
    ]) {
      const { glow, outline, shadow, ...saved } = photo;
      expect([glow, outline, shadow]).toEqual([null, null, null]);
      expect(elementSchema.parse(saved)).toEqual(photo);
    }
  });

  it("keeps photo effects and checks their ranges", () => {
    const image = {
      ...createImageElement(ASSET, PAGE),
      glow: { color: "#ff2e93", size: 40 },
      outline: { color: "#ffffff", width: 12 },
      shadow: { blur: 20, color: "#00000080", offsetX: -8, offsetY: 16 },
    };
    expect(elementSchema.parse(image)).toEqual(image);
    expect(() =>
      elementSchema.parse({
        ...image,
        outline: { color: "#ffffff", width: -1 },
      })
    ).toThrow();
    expect(() =>
      elementSchema.parse({ ...image, glow: { color: "#fff", size: 2001 } })
    ).toThrow();
  });

  it("accepts graphics only with path data in their layers", () => {
    const [sticker] = BUILTIN_GRAPHICS;
    if (!sticker) {
      throw new Error("No built-in graphics");
    }
    const graphic = createGraphicElement(sticker, PAGE);
    const withPath = (d: string) => ({
      ...graphic,
      layers: [{ d, fill: 0 }],
    });
    expect(elementSchema.parse(withPath("M0 0L10 10.5e1z"))).toMatchObject({
      layers: [{ d: "M0 0L10 10.5e1z", fill: 0, stroke: null }],
    });
    expect(() => elementSchema.parse(withPath("M0 0<script>"))).toThrow();
    expect(() => elementSchema.parse(withPath("url(#x)"))).toThrow();
    expect(() => elementSchema.parse(withPath(""))).toThrow();
    expect(() =>
      elementSchema.parse(withPath(`M0 0${"L1 1".repeat(5000)}`))
    ).toThrow();
    expect(() => elementSchema.parse({ ...graphic, palette: [] })).toThrow();
    expect(() =>
      elementSchema.parse({ ...graphic, outline: { color: "#fff", width: 1 } })
    ).toThrow();
  });

  it("rejects unknown element types (migrateDocument leaves them out)", () => {
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

  it("keeps unknown fields next to a photo's effects", () => {
    const image = {
      ...createImageElement(ASSET, PAGE),
      futureEffect: { color: "#00ff00" },
      outline: { color: "#ffffff", width: 8 },
    };
    expect(parseElement(image)).toEqual(image);
  });

  it("keeps fields newer code nested in a graphic's layers and outline", () => {
    const [sticker] = BUILTIN_GRAPHICS;
    if (!sticker) {
      throw new Error("No built-in graphics");
    }
    const graphic = {
      ...createGraphicElement(sticker, PAGE),
      layers: [{ ...sticker.layers[0], gradient: { stops: 2 } }],
      outline: { color: "#ffffff", style: "dashed", width: 0.05 },
    };
    expect(parseElement(graphic)).toEqual(graphic);
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

  it("leaves out elements it can't read and keeps the rest", () => {
    const rect = createBoxElement("rect", PAGE);
    const text = createTextElement("heading", PAGE);
    const sticker = { ...createBoxElement("rect", PAGE), type: "hologram" };
    const document = {
      ...createDocument(PAGE),
      elements: [rect, sticker, { ...rect, id: "bad", opacity: 2 }, text],
    };
    expect(migrateDocument(document).elements).toEqual([rect, text]);
  });

  it("still rejects a document without elements", () => {
    expect(() =>
      migrateDocument({ ...createDocument(PAGE), elements: "none" })
    ).toThrow("list its elements");
  });

  it("returns a valid current-version document unchanged", () => {
    const document = createDocument(PAGE);
    expect(migrateDocument(document)).toEqual(document);
  });

  it("upgrades a version 1 document (from before pages) as it is", () => {
    const rect = createBoxElement("rect", PAGE);
    const old = { ...createDocument(PAGE), elements: [rect], version: 1 };
    expect(migrateDocument(old)).toEqual({
      ...old,
      version: DOCUMENT_VERSION,
    });
    expect(DOCUMENT_VERSION).toBe(2);
  });

  it("rejects non-objects and future versions", () => {
    expect(() => migrateDocument(null)).toThrow("must be an object");
    expect(() =>
      migrateDocument({ ...createDocument(PAGE), version: 99 })
    ).toThrow("newer than supported");
  });
});
