import { describe, expect, it } from "vitest";

import { createDocument, createFrameElement } from "@/lib/document/factories";
import { detachPhoto, fillFrame } from "@/lib/editor/frames";

const PAGE = { height: 720, width: 1280 };
const PHOTO = {
  height: 600,
  id: "8a5b3f4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
  width: 1200,
};

describe("fillFrame", () => {
  it("fills a frame with a photo cropped to cover it", () => {
    const frame = { ...createFrameElement(PAGE), height: 300, width: 300 };
    const document = { ...createDocument(PAGE), elements: [frame] };
    const [filled] = fillFrame(document, frame.id, PHOTO).elements;
    expect(filled).toMatchObject({
      assetId: PHOTO.id,
      crop: { height: 1, width: 0.5, x: 0.25, y: 0 },
    });
  });

  it("leaves anything that isn't a frame alone", () => {
    const document = createDocument(PAGE);
    expect(fillFrame(document, "missing", PHOTO)).toBe(document);
  });

  it("detaches a photo into an image right above its frame", () => {
    const frame = {
      ...createFrameElement(PAGE),
      height: 300,
      rotation: 15,
      width: 300,
    };
    const filled = fillFrame(
      { ...createDocument(PAGE), elements: [frame] },
      frame.id,
      PHOTO
    );
    const { document, imageId } = detachPhoto(filled, frame.id);
    const [emptied, photo] = document.elements;
    expect(emptied).toMatchObject({ assetId: null, crop: null, id: frame.id });
    expect(photo).toMatchObject({
      assetId: PHOTO.id,
      crop: { height: 1, width: 0.5, x: 0.25, y: 0 },
      height: 300,
      id: imageId,
      rotation: 15,
      type: "image",
      width: 300,
    });
  });
});
