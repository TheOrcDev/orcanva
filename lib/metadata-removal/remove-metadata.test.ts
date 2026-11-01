import { describe, expect, it } from "vitest";

import { removeMetadata } from "@/lib/metadata-removal/remove-metadata";
import {
  JPEG,
  PNG,
  ascii,
  file,
  tiff,
} from "@/lib/metadata-removal/test-images";

const bytesOf = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());

describe("removeMetadata", () => {
  it("cleans a file by what it is, not what it's called", async () => {
    const jpeg = file(
      JPEG.start,
      JPEG.exif(tiff({ location: true })),
      JPEG.c2pa,
      JPEG.tables,
      JPEG.scan,
      JPEG.end
    );
    const result = await removeMetadata(
      new File([jpeg], "image.png", { type: "image/png" })
    );
    expect(result).toMatchObject({
      format: "jpg",
      found: ["content-credentials", "location", "camera"],
      redrawn: false,
    });
    expect(result.blob.type).toBe("image/jpeg");
    expect(await bytesOf(result.blob)).toEqual(
      file(JPEG.start, JPEG.tables, JPEG.scan, JPEG.end)
    );
  });

  it("gives back the file as it came when there's nothing to remove", async () => {
    const png = file(PNG.signature, PNG.header, PNG.data, PNG.end);
    const result = await removeMetadata(new Blob([png]));
    expect(result).toMatchObject({ format: "png", found: [], redrawn: false });
    expect(await bytesOf(result.blob)).toEqual(png);
  });

  it("rejects what isn't an image", async () => {
    await expect(
      removeMetadata(new Blob([file(ascii("hello"))]))
    ).rejects.toThrow("couldn't be opened as an image");
  });
});
