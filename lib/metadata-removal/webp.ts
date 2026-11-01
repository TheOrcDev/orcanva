import {
  concat,
  hasAscii,
  readAscii,
  readText,
} from "@/lib/metadata-removal/bytes";
import { readExif } from "@/lib/metadata-removal/exif";
import { inListOrder, noteText } from "@/lib/metadata-removal/metadata";
import type { Cleaned, MetadataKind } from "@/lib/metadata-removal/metadata";

// A WebP is a RIFF file: "RIFF", the size of the rest, "WEBP", then chunks
// of a 4-letter type, a little-endian size and the data, padded to an even
// length.

const HEADER_SIZE = 12;
const CHUNK_HEADER_SIZE = 8;
// VP8X's flags: which optional chunks the file has
const EXIF_FLAG = 8;
const XMP_FLAG = 4;
const EXIF = "Exif\0\0";

// The picture: lossy, lossless and alpha data, the extended header,
// animation, and the colour profile
const KEPT = new Set(["VP8 ", "VP8L", "VP8X", "ALPH", "ANIM", "ANMF", "ICCP"]);

export const isWebp = (bytes: Uint8Array): boolean =>
  hasAscii(bytes, 0, "RIFF") && hasAscii(bytes, 8, "WEBP");

// VP8X with the EXIF and XMP flags cleared, now those chunks are gone
const withoutMetadataFlags = (chunk: Uint8Array): Uint8Array => {
  const copy = new Uint8Array(chunk);
  const flags = copy[CHUNK_HEADER_SIZE];
  copy[CHUNK_HEADER_SIZE] =
    flags -
    (Math.floor(flags / EXIF_FLAG) % 2) * EXIF_FLAG -
    (Math.floor(flags / XMP_FLAG) % 2) * XMP_FLAG;
  return copy;
};

const note = (type: string, data: Uint8Array, found: Set<MetadataKind>) => {
  if (type === "EXIF") {
    // Some writers keep JPEG's "Exif" prefix
    const tiff = hasAscii(data, 0, EXIF) ? data.subarray(EXIF.length) : data;
    found.add("camera");
    if (readExif(tiff).hasLocation) {
      found.add("location");
    }
    return;
  }
  if (type === "XMP ") {
    noteText(readText(data), found);
  }
  found.add(type === "C2PA" ? "content-credentials" : "other");
};

// Copies the chunks that make up the picture and drops the rest, so the
// image data stays exactly the same. Throws when the file isn't a WebP it can
// follow to its end.
export const cleanWebp = (bytes: Uint8Array): Cleaned => {
  if (!isWebp(bytes)) {
    throw new Error("Not a WebP");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riffEnd = Math.min(bytes.length, 8 + view.getUint32(4, true));
  const kept: Uint8Array[] = [];
  const found = new Set<MetadataKind>();
  let position = HEADER_SIZE;

  while (position + CHUNK_HEADER_SIZE <= riffEnd) {
    const type = readAscii(bytes, position, 4);
    const size = view.getUint32(position + 4, true);
    const dataEnd = position + CHUNK_HEADER_SIZE + size;
    if (dataEnd > riffEnd) {
      throw new Error("The WebP ends early");
    }
    // The padding byte after an odd-sized chunk, when the file has it
    const end = Math.min(dataEnd + (size % 2), riffEnd);
    const chunk = bytes.subarray(position, end);
    if (type === "VP8X") {
      kept.push(withoutMetadataFlags(chunk));
    } else if (KEPT.has(type)) {
      kept.push(chunk);
    } else {
      note(type, bytes.subarray(position + CHUNK_HEADER_SIZE, dataEnd), found);
    }
    position = end;
  }
  if (riffEnd < bytes.length) {
    found.add("other");
  }

  const body = concat(kept);
  const header = new Uint8Array(HEADER_SIZE);
  header.set(bytes.subarray(0, HEADER_SIZE));
  // RIFF's size counts everything after itself
  new DataView(header.buffer).setUint32(4, body.length + 4, true);
  return { bytes: concat([header, body]), found: inListOrder(found) };
};
