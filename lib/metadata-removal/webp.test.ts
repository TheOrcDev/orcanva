import { describe, expect, it } from "vitest";

import {
  AI_XMP,
  PLAIN_XMP,
  WEBP,
  ascii,
  file,
  tiff,
  webp,
  webpChunk,
} from "@/lib/metadata-removal/test-images";
import { cleanWebp } from "@/lib/metadata-removal/webp";

// VP8X's flags
const ICC = 0x20;
const ALPHA = 0x10;
const EXIF = 0x08;
const XMP = 0x04;

describe("cleanWebp", () => {
  it("drops the metadata chunks and fixes the header to match", () => {
    const { bytes, found } = cleanWebp(
      file(
        webp(
          WEBP.vp8x(ICC + ALPHA + EXIF + XMP),
          WEBP.icc,
          WEBP.alpha,
          WEBP.image,
          WEBP.exif(tiff()),
          WEBP.xmp(PLAIN_XMP),
          WEBP.c2pa,
          webpChunk("ABCD", [1, 2, 3])
        )
      )
    );
    expect(bytes).toEqual(
      file(webp(WEBP.vp8x(ICC + ALPHA), WEBP.icc, WEBP.alpha, WEBP.image))
    );
    expect(found).toEqual(["content-credentials", "camera", "other"]);
  });

  it("reads the AI tag and a location, with or without EXIF's prefix", () => {
    const { found } = cleanWebp(
      file(
        webp(
          WEBP.vp8x(EXIF + XMP),
          WEBP.image,
          WEBP.exif([...ascii("Exif\0\0"), ...tiff({ location: true })]),
          WEBP.xmp(AI_XMP)
        )
      )
    );
    expect(found).toEqual(["ai-tag", "location", "camera", "other"]);
  });

  it("leaves a simple WebP as it was", () => {
    const clean = file(webp(WEBP.image));
    expect(cleanWebp(clean)).toEqual({ bytes: clean, found: [] });
  });

  it("drops what comes after the RIFF", () => {
    const { bytes, found } = cleanWebp(file(webp(WEBP.image), ascii("extra")));
    expect(bytes).toEqual(file(webp(WEBP.image)));
    expect(found).toEqual(["other"]);
  });

  it("takes a last chunk that's missing its padding byte", () => {
    const unpadded = file(webp(WEBP.image)).slice(0, -1);
    expect(cleanWebp(unpadded).found).toEqual([]);
  });

  it("rejects files it can't follow", () => {
    expect(() => cleanWebp(file(ascii("RIFF0000WAVE")))).toThrow("Not a WebP");
    // Cut off in the middle of the image data
    expect(() => cleanWebp(file(webp(WEBP.image)).slice(0, -3))).toThrow(
      "ends early"
    );
  });
});
