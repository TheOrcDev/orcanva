import { describe, expect, it } from "vitest";

import {
  createDocument,
  createFrameElement,
  createImageElement,
  createTextElement,
} from "@/lib/document/factories";
import type { DesignDocument } from "@/lib/document/schema";
import {
  designToTemplate,
  exportedImageWidth,
  sha256Hex,
  templateAssetId,
} from "@/lib/templates/export";
import type { ExportedImage, TemplateMeta } from "@/lib/templates/export";

const PAGE = { height: 720, width: 1280 };
const PHOTO = { height: 1000, width: 2000 };

const META: TemplateMeta = {
  category: "Test",
  id: "test-template",
  name: "Test template",
  presetId: "youtube-thumbnail",
  preview: "test-template.0123abcd.webp",
  tags: ["test"],
};

const image = (bytes: number[]): ExportedImage => ({
  bytes: new Uint8Array(bytes),
  height: PHOTO.height,
  license: "CC0",
  mimeType: "image/webp",
  name: "Photo",
  source: "Test",
  width: PHOTO.width,
});

// A design whose photos point at uploads with these ids
const design = (photoId: string, otherId: string): DesignDocument => {
  const photo = { ...createImageElement({ ...PHOTO, id: photoId }, PAGE) };
  const frame = { ...createFrameElement(PAGE), assetId: otherId };
  const again = { ...createImageElement({ ...PHOTO, id: photoId }, PAGE) };
  const title = { ...createTextElement("heading", PAGE), groupId: "g" };
  const caption = { ...createTextElement("body", PAGE), groupId: "g" };
  return {
    ...createDocument(PAGE),
    elements: [photo, frame, again, title, caption],
  };
};

const imagesFor = (photoId: string, otherId: string) =>
  new Map([
    [photoId, image([1, 2, 3])],
    [otherId, image([4, 5, 6])],
  ]);

describe("designToTemplate", () => {
  it("gives the same file for the same design every time", () => {
    const source = design("a", "b");
    const first = designToTemplate(source, imagesFor("a", "b"), META);
    const second = designToTemplate(source, imagesFor("a", "b"), META);
    expect(second).toEqual(first);
  });

  it("names assets by their content, whatever the upload ids", () => {
    const original = designToTemplate(
      design("11111111-1111-4111-8111-111111111111", "b"),
      imagesFor("11111111-1111-4111-8111-111111111111", "b"),
      META
    );
    const copy = designToTemplate(
      design("22222222-2222-4222-8222-222222222222", "c"),
      imagesFor("22222222-2222-4222-8222-222222222222", "c"),
      META
    );
    expect(copy.template).toEqual(original.template);

    const sha = sha256Hex(new Uint8Array([1, 2, 3]));
    const [first, second] = original.template.assets;
    expect(first).toMatchObject({
      bytes: 3,
      file: `${sha.slice(0, 16)}.webp`,
      id: templateAssetId(sha),
    });
    expect(second?.id).not.toBe(first?.id);
    expect([...original.files.keys()]).toEqual(
      original.template.assets.map((asset) => asset.file)
    );
  });

  it("renumbers elements and groups in stacking order", () => {
    const { template } = designToTemplate(
      design("a", "b"),
      imagesFor("a", "b"),
      META
    );
    const { elements } = template.document as DesignDocument;
    expect(elements.map((element) => element.id)).toEqual([
      "el-1",
      "el-2",
      "el-3",
      "el-4",
      "el-5",
    ]);
    expect(elements.map((element) => element.groupId)).toEqual([
      null,
      null,
      null,
      "group-1",
      "group-1",
    ]);
    const [photo, frame, again] = elements;
    expect(photo?.type === "image" && photo.assetId).toBe(
      template.assets[0]?.id
    );
    expect(again?.type === "image" && again.assetId).toBe(
      template.assets[0]?.id
    );
    expect(frame?.type === "frame" && frame.assetId).toBe(
      template.assets[1]?.id
    );
  });

  it("refuses a photo it has no file for", () => {
    expect(() =>
      designToTemplate(design("a", "b"), new Map([["a", image([1])]]), META)
    ).toThrow("No image for asset b");
  });
});

describe("exportedImageWidth", () => {
  it("keeps twice the widest the photo is shown, up to its own width", () => {
    const document = design("a", "b");
    // The images are fitted into 80% of the page: 1024 wide
    expect(exportedImageWidth(document, "a", PHOTO)).toBe(2000);
    const small: DesignDocument = {
      ...document,
      elements: document.elements.map((element) =>
        element.type === "image"
          ? {
              ...element,
              crop: { height: 1, width: 0.5, x: 0, y: 0 },
              width: 300,
            }
          : element
      ),
    };
    expect(exportedImageWidth(small, "a", PHOTO)).toBe(1200);
    // The frame (288 square) covers itself with the 2:1 photo: 576 wide
    expect(exportedImageWidth(document, "b", PHOTO)).toBe(1152);
  });
});
