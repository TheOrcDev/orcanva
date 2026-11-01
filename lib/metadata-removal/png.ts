import {
  concat,
  hasAscii,
  readAscii,
  readText,
} from "@/lib/metadata-removal/bytes";
import { readExif } from "@/lib/metadata-removal/exif";
import { inListOrder, noteText } from "@/lib/metadata-removal/metadata";
import type { Cleaned, MetadataKind } from "@/lib/metadata-removal/metadata";

// A PNG is a signature, then chunks: a 4-byte length, a 4-letter type, the
// data and a CRC. Each chunk's CRC covers only itself, so chunks can be
// dropped without touching the others.

const SIGNATURE = "\u0089PNG\r\n\u001A\n";
// Length, type and CRC around a chunk's data
const CHUNK_OVERHEAD = 12;

// What a decoder needs to show the picture as it was: the header, palette,
// image data and transparency, the colour space, the pixel density, and
// APNG's frames. Apple's iDOT is left out: it points at byte offsets that
// dropping chunks moves.
const KEPT = new Set([
  "IHDR",
  "PLTE",
  "IDAT",
  "IEND",
  "tRNS",
  "cHRM",
  "gAMA",
  "iCCP",
  "sBIT",
  "sRGB",
  "cICP",
  "mDCV",
  "cLLI",
  "bKGD",
  "pHYs",
  "acTL",
  "fcTL",
  "fdAT",
]);

const TEXT = new Set(["tEXt", "zTXt", "iTXt"]);

// The text notes Automatic1111, ComfyUI and InvokeAI save the prompt and
// generation settings in
const PROMPT_KEYWORDS = new Set([
  "parameters",
  "prompt",
  "workflow",
  "Dream",
  "sd-metadata",
  "invokeai_metadata",
]);

export const isPng = (bytes: Uint8Array): boolean =>
  hasAscii(bytes, 0, SIGNATURE);

const note = (type: string, data: Uint8Array, found: Set<MetadataKind>) => {
  if (TEXT.has(type)) {
    const keyword = readAscii(data, 0, Math.max(data.indexOf(0), 0));
    found.add(PROMPT_KEYWORDS.has(keyword) ? "prompt" : "other");
    // Compressed notes read as noise, which is fine: they go all the same
    noteText(readText(data), found);
    return;
  }
  if (type === "eXIf") {
    const exif = readExif(data);
    found.add("camera");
    if (exif.hasLocation) {
      found.add("location");
    }
    return;
  }
  found.add(type === "caBX" ? "content-credentials" : "other");
};

// Copies the chunks that make up the picture and drops the rest, so the
// image data stays exactly the same. Throws when the file isn't a PNG it can
// follow to its end.
export const cleanPng = (bytes: Uint8Array): Cleaned => {
  if (!isPng(bytes)) {
    throw new Error("Not a PNG");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const kept: Uint8Array[] = [bytes.subarray(0, SIGNATURE.length)];
  const found = new Set<MetadataKind>();
  let position = SIGNATURE.length;
  let ended = false;

  while (!ended && position + CHUNK_OVERHEAD <= bytes.length) {
    const type = readAscii(bytes, position + 4, 4);
    const end = position + CHUNK_OVERHEAD + view.getUint32(position);
    if (end > bytes.length) {
      throw new Error("The PNG ends early");
    }
    if (KEPT.has(type)) {
      kept.push(bytes.subarray(position, end));
    } else {
      note(type, bytes.subarray(position + 8, end - 4), found);
    }
    ended = type === "IEND";
    position = end;
  }
  if (!ended) {
    throw new Error("The PNG ends early");
  }
  if (position < bytes.length) {
    found.add("other");
  }

  return { bytes: concat(kept), found: inListOrder(found) };
};
