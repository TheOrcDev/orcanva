// A small PDF writer for downloading pages as a PDF: each page is one JPEG
// drawn to fill it, embedded as it is (DCTDecode, so the browser's JPEG is
// the PDF's image, never re-encoded). Loaded only when a download needs it.
// A vector PDF would mean redoing curved text, effects, gradients and the
// WebGL filters, and embedding every font.
//
// The file (PDF 1.4): a header, then numbered objects (the catalog, the
// page tree, the document info, and per page the page, its content stream
// and its image), then a cross-reference table giving each object's byte
// offset, and a trailer pointing at it.

export interface PdfPage {
  // The page's JPEG, as canvas.toBlob made it
  jpeg: Uint8Array;
  // The page's size in points (1/72 inch)
  width: number;
  height: number;
}

export interface JpegInfo {
  width: number;
  height: number;
  // 1 (grey), 3 (YCbCr/RGB) or 4 (CMYK)
  components: number;
}

const START_OF_IMAGE = 0xd8;
const MARKER = 0xff;
// Start-of-frame markers carry the size: C0–CF but C4 (Huffman tables), C8
// (reserved) and CC (arithmetic coding conditioning)
const isStartOfFrame = (marker: number) =>
  marker >= 0xc0 &&
  marker <= 0xcf &&
  marker !== 0xc4 &&
  marker !== 0xc8 &&
  marker !== 0xcc;

// A JPEG's pixel size and colour components, read from its frame header
export const jpegInfo = (jpeg: Uint8Array): JpegInfo => {
  const view = new DataView(jpeg.buffer, jpeg.byteOffset, jpeg.byteLength);
  if (jpeg[0] !== MARKER || jpeg[1] !== START_OF_IMAGE) {
    throw new Error("Not a JPEG");
  }
  let at = 2;
  while (at + 4 <= jpeg.length) {
    if (jpeg[at] !== MARKER) {
      throw new Error("Broken JPEG");
    }
    const marker = jpeg[at + 1] ?? 0;
    // Fill bytes before a marker
    if (marker === MARKER) {
      at += 1;
      continue;
    }
    const length = view.getUint16(at + 2);
    if (isStartOfFrame(marker) && at + 9 < jpeg.length) {
      return {
        components: jpeg[at + 9] ?? 3,
        height: view.getUint16(at + 5),
        width: view.getUint16(at + 7),
      };
    }
    at += 2 + length;
  }
  throw new Error("JPEG without a frame header");
};

const COLOR_SPACES: Record<number, string> = {
  1: "/DeviceGray",
  3: "/DeviceRGB",
  4: "/DeviceCMYK",
};

// Points to two decimals, without trailing zeros
const num = (value: number): string => String(Math.round(value * 100) / 100);

const hex4 = (unit: number) => unit.toString(16).toUpperCase().padStart(4, "0");

// A text string as UTF-16BE hex, which PDF readers take for any name
const textString = (value: string): string => {
  let hex = "FEFF";
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code > 0xff_ff) {
      const offset = code - 0x1_00_00;
      hex += hex4(0xd8_00 + Math.floor(offset / 0x4_00));
      hex += hex4(0xdc_00 + (offset % 0x4_00));
    } else {
      hex += hex4(code);
    }
  }
  return `<${hex}>`;
};

// Each page is three objects (the page, its content, its image) after the
// catalog, page tree and info
const pageId = (index: number) => 4 + index * 3;

// PDF's own date form: D:YYYYMMDDHHmmSSZ
const pdfDate = (date: Date): string =>
  `D:${date.toISOString().replaceAll(/[-:T]/gu, "").slice(0, 14)}Z`;

// The file as parts in order (the JPEGs aren't copied); a Blob of them is
// the .pdf. Pages come out in the order given.
export const pdfParts = (
  pages: readonly PdfPage[],
  { title, created = new Date() }: { title?: string; created?: Date } = {}
): Uint8Array[] => {
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const offsets: number[] = [];
  let length = 0;
  const write = (part: string | Uint8Array) => {
    const bytes = typeof part === "string" ? encoder.encode(part) : part;
    parts.push(bytes);
    length += bytes.length;
  };
  const object = (id: number, body: string) => {
    offsets[id] = length;
    write(`${id} 0 obj\n${body}\nendobj\n`);
  };

  // A comment of bytes over 127 marks the file as binary
  write("%PDF-1.4\n%");
  write(new Uint8Array([0xe2, 0xe3, 0xcf, 0xd3]));
  write("\n");

  // Objects 1–3, then three per page from 4
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(
    2,
    `<< /Type /Pages /Kids [${pages.map((_, index) => `${pageId(index)} 0 R`).join(" ")}] /Count ${pages.length} >>`
  );
  object(
    3,
    `<< /Producer (Orcanva) /CreationDate (${pdfDate(created)})${title ? ` /Title ${textString(title)}` : ""} >>`
  );
  for (const [index, page] of pages.entries()) {
    const id = pageId(index);
    const image = jpegInfo(page.jpeg);
    const width = num(page.width);
    const height = num(page.height);
    object(
      id,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${width} ${height}] /Resources << /XObject << /Im0 ${id + 2} 0 R >> /ProcSet [/PDF /ImageC /ImageB] >> /Contents ${id + 1} 0 R >>`
    );
    const content = `q\n${width} 0 0 ${height} 0 0 cm\n/Im0 Do\nQ\n`;
    object(
      id + 1,
      `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream`
    );
    offsets[id + 2] = length;
    write(
      `${id + 2} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace ${COLOR_SPACES[image.components] ?? "/DeviceRGB"} /BitsPerComponent 8 /Filter /DCTDecode${image.components === 4 ? " /Decode [1 0 1 0 1 0 1 0]" : ""} /Length ${page.jpeg.length} >>\nstream\n`
    );
    write(page.jpeg);
    write("\nendstream\nendobj\n");
  }

  // Each cross-reference entry is exactly 20 bytes
  const count = pageId(pages.length);
  const xref = length;
  let table = `xref\n0 ${count}\n0000000000 65535 f \n`;
  for (let id = 1; id < count; id += 1) {
    table += `${String(offsets[id] ?? 0).padStart(10, "0")} 00000 n \n`;
  }
  write(table);
  write(
    `trailer\n<< /Size ${count} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  );
  return parts;
};

export const pdfBlob = (
  pages: readonly PdfPage[],
  options?: { title?: string; created?: Date }
): Blob =>
  new Blob(pdfParts(pages, options) as BlobPart[], {
    type: "application/pdf",
  });

// A page in points from its size in pixels at 96 per inch: 0.75 pt per px
export const PT_PER_PX = 0.75;
