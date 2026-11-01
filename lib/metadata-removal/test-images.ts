// Tiny JPEG, PNG and WebP files for the tests, built byte by byte with the
// metadata real ones carry. They don't decode to pictures: the readers only
// follow the files' structure.

export const ascii = (text: string): number[] =>
  [...text].map((char) => char.codePointAt(0) ?? 0);

const u16 = (value: number): number[] => {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value);
  return [...bytes];
};

const u32 = (value: number, littleEndian = false): number[] => {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value, littleEndian);
  return [...bytes];
};

export const file = (...parts: number[][]): Uint8Array<ArrayBuffer> =>
  new Uint8Array(parts.flat());

// XMP as Gemini and others write it, with IPTC's AI source type
export const AI_XMP =
  '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF><rdf:Description Iptc4xmpExt:DigitalSourceType="http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"/></rdf:RDF></x:xmpmeta>';

export const PLAIN_XMP =
  '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF><rdf:Description xmp:CreatorTool="Photo editor"/></rdf:RDF></x:xmpmeta>';

// A JUMBF box labelled the way C2PA's manifest store is
const C2PA_BOX = [...ascii("jumb"), ...ascii("jumd"), ...ascii("c2pa"), 0];

// An EXIF directory with an orientation and either a GPS position or the
// camera's make
export const tiff = ({
  littleEndian = false,
  location = false,
  orientation = 1,
} = {}): number[] => {
  const view = new DataView(new ArrayBuffer(58));
  const set16 = (offset: number, value: number) =>
    view.setUint16(offset, value, littleEndian);
  const set32 = (offset: number, value: number) =>
    view.setUint32(offset, value, littleEndian);
  view.setUint16(0, littleEndian ? 0x49_49 : 0x4d_4d);
  set16(2, 42);
  set32(4, 8);
  // Two entries: the orientation, then the GPS directory's offset or the make
  set16(8, 2);
  set16(10, 0x01_12);
  set16(12, 3);
  set32(14, 1);
  set16(18, orientation);
  set16(22, location ? 0x88_25 : 0x01_0f);
  set16(24, 4);
  set32(26, 1);
  set32(30, 40);
  // The GPS directory: the latitude
  set16(40, 1);
  set16(42, 2);
  set16(44, 5);
  set32(46, 3);
  return [...new Uint8Array(view.buffer)];
};

export const jpegSegment = (marker: number, ...data: number[][]): number[] => {
  const payload = data.flat();
  return [0xff, marker, ...u16(payload.length + 2), ...payload];
};

export const JPEG = {
  adobe: jpegSegment(0xee, ascii("Adobe"), [0, 100, 0, 0, 0, 0, 1]),
  c2pa: jpegSegment(0xeb, ascii("JP"), [0, 1, 0, 0, 0, 1], C2PA_BOX),
  comment: jpegSegment(0xfe, ascii("Edited")),
  end: [0xff, 0xd9],
  exif: (directory: number[]) =>
    jpegSegment(0xe1, ascii("Exif\0\0"), directory),
  huffman: jpegSegment(0xc4, [0x10, ...Array.from({ length: 16 }, () => 0)]),
  icc: jpegSegment(0xe2, ascii("ICC_PROFILE\0"), [1, 1, 7, 7, 7]),
  jfif: jpegSegment(0xe0, ascii("JFIF\0"), [1, 2, 0, 0, 1, 0, 1, 0, 0]),
  mpf: jpegSegment(0xe2, ascii("MPF\0"), [0, 0, 0, 0]),
  photoshop: jpegSegment(0xed, ascii("Photoshop 3.0\0"), ascii("8BIM")),
  // Scan data with a stuffed 0xFF00 and a restart marker, neither of which
  // ends it
  scan: [
    ...jpegSegment(0xda, [1, 1, 0, 0, 63, 0]),
    0x12,
    0xff,
    0x00,
    0x34,
    0xff,
    0xd0,
    0x56,
  ],
  start: [0xff, 0xd8],
  // Quantization table and frame header
  tables: [
    ...jpegSegment(0xdb, [0, ...Array.from({ length: 64 }, () => 1)]),
    ...jpegSegment(0xc0, [8, 0, 16, 0, 16, 1, 1, 0x11, 0]),
  ],
  xmp: (body: string) =>
    jpegSegment(0xe1, ascii("http://ns.adobe.com/xap/1.0/\0"), ascii(body)),
};

// CRCs aren't checked, since chunks are copied whole, so they're zero here
export const pngChunk = (type: string, ...data: number[][]): number[] => {
  const payload = data.flat();
  return [...u32(payload.length), ...ascii(type), ...payload, 0, 0, 0, 0];
};

export const PNG = {
  c2pa: pngChunk("caBX", C2PA_BOX),
  data: pngChunk("IDAT", [0x78, 0x9c, 1, 2, 3]),
  end: pngChunk("IEND"),
  exif: (directory: number[]) => pngChunk("eXIf", directory),
  header: pngChunk("IHDR", u32(1), u32(1), [8, 6, 0, 0, 0]),
  signature: [0x89, ...ascii("PNG\r\n"), 0x1a, 0x0a],
  srgb: pngChunk("sRGB", [0]),
  text: (keyword: string, text: string) =>
    pngChunk("tEXt", ascii(keyword), [0], ascii(text)),
  xmp: (body: string) =>
    pngChunk("iTXt", ascii("XML:com.adobe.xmp"), [0, 0, 0, 0, 0], ascii(body)),
};

// Odd sizes get a padding byte
export const webpChunk = (type: string, ...data: number[][]): number[] => {
  const payload = data.flat();
  const padding = payload.length % 2 === 1 ? [0] : [];
  return [...ascii(type), ...u32(payload.length, true), ...payload, ...padding];
};

export const webp = (...chunks: number[][]): number[] => {
  const body = chunks.flat();
  return [
    ...ascii("RIFF"),
    ...u32(body.length + 4, true),
    ...ascii("WEBP"),
    ...body,
  ];
};

export const WEBP = {
  alpha: webpChunk("ALPH", [9, 9]),
  c2pa: webpChunk("C2PA", C2PA_BOX),
  exif: (directory: number[]) => webpChunk("EXIF", directory),
  icc: webpChunk("ICCP", [1, 2, 3, 4]),
  // An odd size, so it's padded
  image: webpChunk("VP8 ", [1, 2, 3, 4, 5]),
  // The flags, three reserved bytes, the canvas's width and height
  vp8x: (flags: number) =>
    webpChunk("VP8X", [flags, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
  xmp: (body: string) => webpChunk("XMP ", ascii(body)),
};
