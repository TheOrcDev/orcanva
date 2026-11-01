import {
  concat,
  hasAscii,
  includesAscii,
  readAscii,
  readText,
} from "@/lib/metadata-removal/bytes";
import { orientationOnlyExif, readExif } from "@/lib/metadata-removal/exif";
import { inListOrder, noteText } from "@/lib/metadata-removal/metadata";
import type { Cleaned, MetadataKind } from "@/lib/metadata-removal/metadata";

// A JPEG is a run of segments, each a 0xFF, a marker byte and (mostly) a
// 16-bit length. Metadata only lives in the application segments (APP0 to
// APP15) and comments; the rest is the picture.

const MARKER = 0xff;
const START = 0xd8;
const END = 0xd9;
const SCAN = 0xda;
const COMMENT = 0xfe;
const APP0 = 0xe0;
const APP1 = 0xe1;
const APP2 = 0xe2;
const APP11 = 0xeb;
const APP13 = 0xed;
const APP14 = 0xee;
const APP15 = 0xef;
const RESTART0 = 0xd0;
const RESTART7 = 0xd7;
const TEMPORARY = 0x01;
// A 0xFF inside a scan's data is followed by this, so it isn't a marker
const STUFFED = 0x00;

const EXIF = "Exif\0\0";
const XMP = "http://ns.adobe.com/xap/1.0/\0";
const XMP_EXTENSION = "http://ns.adobe.com/xmp/extension/\0";

// The application segments a decoder reads: the JFIF header, the colour
// profile, and Adobe's colour transform (CMYK and YCCK JPEGs need it)
const KEPT = [
  { identifier: "JFIF\0", marker: APP0 },
  { identifier: "ICC_PROFILE\0", marker: APP2 },
  { identifier: "Adobe", marker: APP14 },
] as const;

const isRestart = (marker: number) => marker >= RESTART0 && marker <= RESTART7;

const isMetadata = (marker: number) =>
  (marker >= APP0 && marker <= APP15) || marker === COMMENT;

const isKept = (marker: number, data: Uint8Array) =>
  KEPT.some(
    (kept) => kept.marker === marker && hasAscii(data, 0, kept.identifier)
  );

export const isJpeg = (bytes: Uint8Array): boolean =>
  bytes[0] === MARKER && bytes[1] === START && bytes[2] === MARKER;

// Where a scan's entropy-coded data ends: the first 0xFF that isn't stuffed
// or a restart marker
const scanEnd = (bytes: Uint8Array, from: number): number => {
  let index = bytes.indexOf(MARKER, from);
  while (index !== -1 && index + 1 < bytes.length) {
    const next = bytes[index + 1];
    if (next !== STUFFED && !isRestart(next)) {
      return index;
    }
    index = bytes.indexOf(MARKER, index + 2);
  }
  return bytes.length;
};

// Notes what a dropped segment held; returns the orientation if it was EXIF
const note = (
  marker: number,
  data: Uint8Array,
  found: Set<MetadataKind>
): number | null => {
  if (marker === APP1 && hasAscii(data, 0, EXIF)) {
    const exif = readExif(data.subarray(EXIF.length));
    if (!exif.orientationOnly) {
      found.add("camera");
    }
    if (exif.hasLocation) {
      found.add("location");
    }
    return exif.orientation;
  }
  if (
    marker === APP1 &&
    (hasAscii(data, 0, XMP) || hasAscii(data, 0, XMP_EXTENSION))
  ) {
    noteText(readText(data), found);
    found.add("other");
    return null;
  }
  // JUMBF boxes; C2PA's is labelled "c2pa"
  if (marker === APP11 && includesAscii(data, "c2pa")) {
    found.add("content-credentials");
    return null;
  }
  // Photoshop's resources, with IPTC captions and credits
  if (marker === APP13) {
    noteText(readAscii(data, 0, data.length), found);
  }
  found.add("other");
  return null;
};

// An APP1 segment of EXIF holding nothing but the orientation
const exifSegment = (orientation: number): Uint8Array<ArrayBuffer> => {
  const tiff = orientationOnlyExif(orientation);
  const segment = new Uint8Array(4 + EXIF.length + tiff.length);
  segment.set([MARKER, APP1]);
  // The length counts its own two bytes but not the marker
  new DataView(segment.buffer).setUint16(2, segment.length - 2);
  segment.set(new TextEncoder().encode(EXIF), 4);
  segment.set(tiff, 4 + EXIF.length);
  return segment;
};

// Copies every segment but the metadata, so the picture's bytes, and its
// quality, stay exactly the same. Throws when the file isn't a JPEG it can
// follow to the end.
export const cleanJpeg = (bytes: Uint8Array): Cleaned => {
  if (!isJpeg(bytes)) {
    throw new Error("Not a JPEG");
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const kept: Uint8Array[] = [];
  const found = new Set<MetadataKind>();
  let orientation = 1;
  let position = 2;

  while (position < bytes.length) {
    if (bytes[position] !== MARKER) {
      throw new Error("The JPEG is damaged");
    }
    // Any number of 0xFF fill bytes may come before a marker
    while (bytes[position] === MARKER) {
      position += 1;
    }
    const start = position - 1;
    const marker = bytes[position];
    position += 1;
    if (marker === END) {
      break;
    }
    if (marker === TEMPORARY || isRestart(marker)) {
      kept.push(bytes.subarray(start, position));
      continue;
    }
    if (position + 2 > bytes.length) {
      throw new Error("The JPEG ends early");
    }
    // The length counts its own two bytes but not the marker
    const end = position + view.getUint16(position);
    if (end > bytes.length) {
      throw new Error("The JPEG ends early");
    }
    if (marker === SCAN) {
      position = scanEnd(bytes, end);
      kept.push(bytes.subarray(start, position));
      continue;
    }
    const data = bytes.subarray(position + 2, end);
    position = end;
    if (isMetadata(marker) && !isKept(marker, data)) {
      orientation = note(marker, data, found) ?? orientation;
    } else {
      kept.push(bytes.subarray(start, end));
    }
  }
  // Phones append more after the end: Samsung's edit history, the HDR
  // gain map of an Ultra HDR photo
  if (position < bytes.length) {
    found.add("other");
  }
  if (orientation !== 1) {
    // EXIF goes right after the JFIF header, or first when there's none
    kept.splice(kept[0]?.[1] === APP0 ? 1 : 0, 0, exifSegment(orientation));
  }

  return {
    bytes: concat([
      Uint8Array.of(MARKER, START),
      ...kept,
      Uint8Array.of(MARKER, END),
    ]),
    found: inListOrder(found),
  };
};
