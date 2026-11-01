import { describe, expect, it } from "vitest";

import { readExif } from "@/lib/metadata-removal/exif";
import { cleanJpeg } from "@/lib/metadata-removal/jpeg";
import {
  AI_XMP,
  JPEG,
  PLAIN_XMP,
  ascii,
  file,
  tiff,
} from "@/lib/metadata-removal/test-images";

const PICTURE = [JPEG.tables, JPEG.huffman, JPEG.scan];

describe("cleanJpeg", () => {
  it("keeps what the picture needs and drops the rest", () => {
    const { bytes, found } = cleanJpeg(
      file(
        JPEG.start,
        JPEG.jfif,
        JPEG.exif(tiff({ location: true })),
        JPEG.xmp(AI_XMP),
        JPEG.c2pa,
        JPEG.photoshop,
        JPEG.icc,
        JPEG.mpf,
        JPEG.comment,
        JPEG.adobe,
        ...PICTURE,
        JPEG.end,
        // Samsung's trailer
        ascii("SEFHtrailer")
      )
    );
    expect(bytes).toEqual(
      file(JPEG.start, JPEG.jfif, JPEG.icc, JPEG.adobe, ...PICTURE, JPEG.end)
    );
    expect(found).toEqual([
      "content-credentials",
      "ai-tag",
      "location",
      "camera",
      "other",
    ]);
  });

  it.each([false, true])(
    "keeps a rotated photo the right way up (little-endian EXIF: %s)",
    (littleEndian) => {
      const { bytes, found } = cleanJpeg(
        file(
          JPEG.start,
          JPEG.jfif,
          JPEG.exif(tiff({ littleEndian, orientation: 6 })),
          ...PICTURE,
          JPEG.end
        )
      );
      expect(found).toEqual(["camera"]);
      const afterJfif = 2 + JPEG.jfif.length;
      expect(bytes.subarray(0, afterJfif)).toEqual(file(JPEG.start, JPEG.jfif));
      // FF E1, the length, "Exif\0\0", then the directory
      const exif = bytes.subarray(afterJfif);
      expect([...exif.subarray(0, 2)]).toEqual([0xff, 0xe1]);
      expect(readExif(exif.subarray(10))).toEqual({
        hasLocation: false,
        orientation: 6,
        orientationOnly: true,
      });
      // The EXIF it wrote isn't metadata to remove
      expect(cleanJpeg(bytes)).toEqual({ bytes, found: [] });
    }
  );

  it("puts the orientation first when there's no JFIF header", () => {
    const { bytes } = cleanJpeg(
      file(
        JPEG.start,
        JPEG.exif(tiff({ orientation: 8 })),
        ...PICTURE,
        JPEG.end
      )
    );
    expect([...bytes.subarray(2, 4)]).toEqual([0xff, 0xe1]);
  });

  it("leaves a clean file as it was", () => {
    const clean = file(JPEG.start, JPEG.jfif, JPEG.icc, ...PICTURE, JPEG.end);
    expect(cleanJpeg(clean)).toEqual({ bytes: clean, found: [] });
  });

  it("follows a progressive JPEG's scans to the end", () => {
    const { bytes, found } = cleanJpeg(
      file(
        JPEG.start,
        ...PICTURE,
        JPEG.comment,
        JPEG.huffman,
        JPEG.scan,
        JPEG.xmp(PLAIN_XMP),
        JPEG.scan,
        JPEG.end
      )
    );
    expect(bytes).toEqual(
      file(JPEG.start, ...PICTURE, JPEG.huffman, JPEG.scan, JPEG.scan, JPEG.end)
    );
    expect(found).toEqual(["other"]);
  });

  it("reads markers after fill bytes", () => {
    const { bytes } = cleanJpeg(
      file(JPEG.start, [0xff, 0xff], JPEG.jfif, ...PICTURE, JPEG.end)
    );
    expect(bytes).toEqual(file(JPEG.start, JPEG.jfif, ...PICTURE, JPEG.end));
  });

  it("finishes a file that stops in the middle of its scan", () => {
    const { bytes } = cleanJpeg(file(JPEG.start, ...PICTURE));
    expect(bytes).toEqual(file(JPEG.start, ...PICTURE, JPEG.end));
  });

  it("rejects files it can't follow", () => {
    expect(() => cleanJpeg(file(ascii("not a jpeg")))).toThrow("Not a JPEG");
    expect(() => cleanJpeg(file(JPEG.start, JPEG.jfif.slice(0, 8)))).toThrow(
      "ends early"
    );
    expect(() =>
      cleanJpeg(file(JPEG.start, JPEG.jfif, [0x00, 0x01], ...PICTURE))
    ).toThrow("damaged");
  });
});
