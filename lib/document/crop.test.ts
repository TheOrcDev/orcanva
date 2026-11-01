import { describe, expect, it } from "vitest";

import {
  clampCrop,
  containRect,
  coverCrop,
  coverRect,
  cropBetween,
  cropToPixels,
  cropZoom,
  fullPhotoSize,
  mirrorCrop,
  photoRect,
  zoomCrop,
} from "@/lib/document/crop";
import { createImageElement } from "@/lib/document/factories";
import { elementSchema } from "@/lib/document/schema";

const ASSET = {
  height: 600,
  id: "8a5b3f4e-1c2d-4e5f-8a9b-0c1d2e3f4a5b",
  width: 800,
};

describe("crop", () => {
  it("reads images saved before cropping as uncropped, and rejects crops outside", () => {
    const { crop, ...saved } = createImageElement(ASSET, {
      height: 720,
      width: 1280,
    });
    expect(crop).toBeNull();
    expect(elementSchema.parse(saved)).toMatchObject({ crop: null });
    expect(() =>
      elementSchema.parse({
        ...saved,
        crop: { height: 0.5, width: 0.6, x: 0.5, y: 0 },
      })
    ).toThrow();
  });

  it("converts to pixels of whatever is drawn", () => {
    const crop = { height: 0.5, width: 0.25, x: 0.5, y: 0.25 };
    expect(cropToPixels(crop, { height: 600, width: 800 })).toEqual({
      height: 300,
      width: 200,
      x: 400,
      y: 150,
    });
    expect(cropToPixels(null, { height: 10, width: 20 })).toEqual({
      height: 10,
      width: 20,
      x: 0,
      y: 0,
    });
  });

  it("knows how big the whole photo is behind a crop", () => {
    expect(
      fullPhotoSize(
        { height: 100, width: 100 },
        { height: 0.5, width: 0.25, x: 0, y: 0 }
      )
    ).toEqual({
      height: 200,
      width: 400,
    });
  });

  it("covers a box of another shape from the middle", () => {
    expect(
      coverCrop({ height: 100, width: 200 }, { height: 100, width: 100 })
    ).toEqual({
      height: 1,
      width: 0.5,
      x: 0.25,
      y: 0,
    });
    expect(
      coverCrop({ height: 200, width: 100 }, { height: 100, width: 100 })
    ).toEqual({
      height: 0.5,
      width: 1,
      x: 0,
      y: 0.25,
    });
  });

  it("keeps crops inside the photo", () => {
    expect(clampCrop({ height: 2, width: 0.5, x: 0.8, y: -1 })).toEqual({
      height: 1,
      width: 0.5,
      x: 0.5,
      y: 0,
    });
  });

  it("mirrors for flipped photos", () => {
    expect(
      mirrorCrop({ height: 1, width: 0.25, x: 0, y: 0 }, true, false)
    ).toEqual({
      height: 1,
      width: 0.25,
      x: 0.75,
      y: 0,
    });
  });

  it("goes from a frame and a photo on the page to a crop and back", () => {
    const frame = { height: 100, width: 100, x: 50, y: 50 };
    const photo = { height: 200, width: 400, x: 0, y: 0 };
    const crop = cropBetween(frame, photo);
    expect(crop).toEqual({ height: 0.5, width: 0.25, x: 0.125, y: 0.25 });
    expect(photoRect(frame, crop)).toEqual(photo);
  });

  it("keeps a frame inside the photo and the photo over the frame", () => {
    const photo = { height: 100, width: 200, x: 0, y: 0 };
    expect(
      containRect({ height: 50, width: 300, x: -10, y: 80 }, photo)
    ).toEqual({
      height: 50,
      width: 200,
      x: 0,
      y: 50,
    });
    const frame = { height: 100, width: 100, x: 0, y: 0 };
    // Twice as big to cover the height, then moved left onto the frame
    expect(coverRect({ height: 50, width: 100, x: 10, y: 0 }, frame)).toEqual({
      height: 100,
      width: 200,
      x: 0,
      y: 0,
    });
  });

  it("zooms a crop around its centre, keeping its shape", () => {
    const crop = { height: 0.5, width: 1, x: 0, y: 0.25 };
    expect(cropZoom(crop)).toBe(1);
    const zoomed = zoomCrop(crop, 2);
    expect(zoomed).toEqual({ height: 0.25, width: 0.5, x: 0.25, y: 0.375 });
    expect(cropZoom(zoomed)).toBe(2);
    expect(zoomCrop(zoomed, 1)).toEqual(crop);
  });
});
