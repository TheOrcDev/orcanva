import { describe, expect, it } from "vitest";

import {
  createDocument,
  createFrameElement,
  createImageElement,
} from "@/lib/document/factories";
import { FRAME_SHAPES } from "@/lib/document/frame-shapes";
import type { PhotoEffects } from "@/lib/document/schema";
import { detachPhoto, fillFrame, photoIntoFrame } from "@/lib/editor/frames";
import { photoClip } from "@/lib/photo-effects/mask";

const PAGE = { height: 720, width: 1280 };
const PHOTO = {
  height: 600,
  id: "8a5b3f4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
  width: 1200,
};

const STICKER: PhotoEffects = {
  glow: null,
  outline: { color: "#ffffff", width: 12 },
  shadow: { blur: 16, color: "#00000066", offsetX: 0, offsetY: 8 },
};
const NEON: PhotoEffects = {
  glow: { color: "#ff2e93", size: 40 },
  outline: { color: "#ff2e93", width: 4 },
  shadow: null,
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

  it("keeps a frame's effects when its photo is replaced or detached", () => {
    const frame = {
      ...createFrameElement(PAGE),
      ...STICKER,
      height: 300,
      width: 300,
    };
    const filled = fillFrame(
      { ...createDocument(PAGE), elements: [frame] },
      frame.id,
      PHOTO
    );
    expect(filled.elements[0]).toMatchObject(STICKER);
    const { document } = detachPhoto(filled, frame.id);
    const [emptied, photo] = document.elements;
    expect(photo).toMatchObject({ ...STICKER, type: "image" });
    expect(emptied).toMatchObject({ ...STICKER, assetId: null });
  });

  it("draws a frame's effects along its shape, and an image's on its box", () => {
    const heart = { ...createFrameElement(PAGE, "heart"), ...STICKER };
    expect(photoClip(heart)).toEqual({
      kind: "shape",
      path: FRAME_SHAPES.find((shape) => shape.id === "heart")?.path,
    });
    // A shape this version doesn't know draws (and outlines) a square
    expect(photoClip({ ...heart, shape: "newer-shape" })).toEqual({
      kind: "shape",
      path: "M0 0H1V1H0Z",
    });
    const image = { ...createImageElement(PHOTO, PAGE), cornerRadius: 24 };
    expect(photoClip(image)).toEqual({ kind: "box", radius: 24 });
    // Detached, the photo is a plain box with the frame's effects
    const { document } = detachPhoto(
      fillFrame(
        { ...createDocument(PAGE), elements: [heart] },
        heart.id,
        PHOTO
      ),
      heart.id
    );
    const [, detached] = document.elements;
    expect(detached?.type === "image" && photoClip(detached)).toEqual({
      kind: "box",
      radius: 0,
    });
  });

  it("gives a frame without effects the dropped image's", () => {
    const plain = { ...createFrameElement(PAGE), height: 300, width: 300 };
    const styled = { ...plain, ...STICKER, id: "styled-frame" };
    const image = { ...createImageElement(PHOTO, PAGE), ...NEON };
    const document = {
      ...createDocument(PAGE),
      elements: [plain, styled, image],
    };
    const [taken] = photoIntoFrame(
      document,
      image.id,
      plain.id,
      PHOTO
    ).elements;
    expect(taken).toMatchObject(NEON);
    const [, kept] = photoIntoFrame(
      document,
      image.id,
      styled.id,
      PHOTO
    ).elements;
    expect(kept).toMatchObject(STICKER);
  });

  it("moves an image's photo into a frame and removes the image", () => {
    const frame = { ...createFrameElement(PAGE), height: 300, width: 300 };
    const image = { ...createImageElement(PHOTO, PAGE), flipX: true };
    const document = { ...createDocument(PAGE), elements: [frame, image] };
    const moved = photoIntoFrame(document, image.id, frame.id, PHOTO);
    expect(moved.elements).toHaveLength(1);
    expect(moved.elements[0]).toMatchObject({ assetId: PHOTO.id, flipX: true });
    expect(photoIntoFrame(document, frame.id, frame.id, PHOTO)).toBe(document);
  });
});
