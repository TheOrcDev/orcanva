import { describe, expect, it } from "vitest";

import { cleanPng } from "@/lib/metadata-removal/png";
import {
  AI_XMP,
  PNG,
  ascii,
  file,
  pngChunk,
  tiff,
} from "@/lib/metadata-removal/test-images";

describe("cleanPng", () => {
  it("keeps the picture's chunks and drops the rest", () => {
    const { bytes, found } = cleanPng(
      file(
        PNG.signature,
        PNG.header,
        PNG.srgb,
        PNG.text("parameters", "a castle at dusk, Steps: 30, Seed: 42"),
        PNG.xmp(AI_XMP),
        PNG.exif(tiff({ location: true })),
        PNG.c2pa,
        pngChunk("tIME", [7, 234, 11, 1, 12, 0, 0]),
        // Apple's, whose offsets dropping chunks would break
        pngChunk("iDOT", [0, 0, 0, 2]),
        PNG.data,
        PNG.end,
        ascii("after the end")
      )
    );
    expect(bytes).toEqual(
      file(PNG.signature, PNG.header, PNG.srgb, PNG.data, PNG.end)
    );
    expect(found).toEqual([
      "content-credentials",
      "ai-tag",
      "prompt",
      "location",
      "camera",
      "other",
    ]);
  });

  it("names ComfyUI's workflow as a prompt", () => {
    const { found } = cleanPng(
      file(
        PNG.signature,
        PNG.header,
        PNG.text("workflow", "{}"),
        PNG.data,
        PNG.end
      )
    );
    expect(found).toEqual(["prompt"]);
  });

  it("leaves a clean file as it was, APNG frames and transparency included", () => {
    const clean = file(
      PNG.signature,
      PNG.header,
      pngChunk("acTL", [0, 0, 0, 1, 0, 0, 0, 0]),
      pngChunk("tRNS", [0, 0]),
      pngChunk("fcTL", [0, 0, 0, 0]),
      PNG.data,
      pngChunk("fdAT", [0, 0, 0, 1, 9]),
      PNG.end
    );
    expect(cleanPng(clean)).toEqual({ bytes: clean, found: [] });
  });

  it("rejects files it can't follow", () => {
    expect(() => cleanPng(file(ascii("not a png")))).toThrow("Not a PNG");
    expect(() => cleanPng(file(PNG.signature, PNG.header, PNG.data))).toThrow(
      "ends early"
    );
    expect(() =>
      cleanPng(file(PNG.signature, PNG.header, PNG.data.slice(0, 10)))
    ).toThrow("ends early");
  });
});
