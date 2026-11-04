import { describe, expect, it } from "vitest";

import { jpegInfo, pdfParts } from "@/lib/export/pdf";

// The start of a JPEG: SOI, an APP0, and a baseline frame header saying
// its size; `tag` makes each one tell apart
const fakeJpeg = (width: number, height: number, tag: number): Uint8Array =>
  new Uint8Array([
    0xff,
    0xd8,
    // APP0, 16 bytes
    0xff,
    0xe0,
    0x00,
    0x10,
    ...Array.from({ length: 14 }, () => tag),
    // SOF0: length 17, precision 8, height, width, 3 components
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08,
    Math.floor(height / 256),
    height % 256,
    Math.floor(width / 256),
    width % 256,
    0x03,
    ...Array.from({ length: 9 }, () => 0),
    0xff,
    0xd9,
  ]);

const text = (parts: readonly Uint8Array[]): string => {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  // latin1 keeps one character per byte, so offsets are string indexes
  return new TextDecoder("latin1").decode(out);
};

describe("jpegInfo", () => {
  it("reads the size and components from the frame header", () => {
    expect(jpegInfo(fakeJpeg(2160, 2700, 1))).toEqual({
      components: 3,
      height: 2700,
      width: 2160,
    });
  });

  it("refuses what isn't a JPEG", () => {
    expect(() => jpegInfo(new Uint8Array([0x89, 0x50]))).toThrow("Not a JPEG");
  });
});

describe("pdfParts", () => {
  const pages = [
    { height: 1012.5, jpeg: fakeJpeg(2160, 2700, 1), width: 810 },
    { height: 1012.5, jpeg: fakeJpeg(2160, 2700, 2), width: 810 },
    { height: 540, jpeg: fakeJpeg(1920, 1080, 3), width: 960 },
  ];
  const pdf = text(pdfParts(pages, { title: "Carousel ✨" }));

  it("points every cross-reference entry at its object", () => {
    const startxref = Number(
      /startxref\n(?<offset>\d+)\n%%EOF\n$/u.exec(pdf)?.groups?.offset
    );
    expect(pdf.slice(startxref, startxref + 5)).toBe("xref\n");
    const count = /xref\n0 (?<count>\d+)\n/u.exec(pdf)?.groups?.count;
    expect(Number(count)).toBe(4 + pages.length * 3);
    const entries = pdf
      .slice(startxref)
      .split("\n")
      .filter((line) => line.endsWith(" 00000 n "));
    expect(entries).toHaveLength(Number(count) - 1);
    for (const [index, entry] of entries.entries()) {
      const offset = Number(entry.slice(0, 10));
      expect(pdf.slice(offset, offset + 20)).toMatch(
        new RegExp(`^${index + 1} 0 obj\\n`, "u")
      );
    }
    expect(pdf.startsWith("%PDF-1.4\n")).toBe(true);
    expect(pdf).toMatch(/trailer\n<< \/Size 13 \/Root 1 0 R \/Info 3 0 R >>/u);
  });

  it("sizes each page in points and fills it with its image", () => {
    const boxes = [
      ...pdf.matchAll(
        /\/MediaBox \[0 0 (?<width>[\d.]+) (?<height>[\d.]+)\]/gu
      ),
    ];
    expect(boxes.map((box) => [box.groups?.width, box.groups?.height])).toEqual(
      [
        ["810", "1012.5"],
        ["810", "1012.5"],
        ["960", "540"],
      ]
    );
    expect(pdf).toContain("q\n810 0 0 1012.5 0 0 cm\n/Im0 Do\nQ\n");
    expect(pdf).toContain(
      "/Width 2160 /Height 2700 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode"
    );
  });

  it("keeps the pages in order, each with its own image", () => {
    expect(pdf).toContain("/Kids [4 0 R 7 0 R 10 0 R] /Count 3");
    for (const [index, page] of pages.entries()) {
      const id = 4 + index * 3;
      expect(pdf).toContain(`/XObject << /Im0 ${id + 2} 0 R >>`);
      const start = pdf.indexOf(`${id + 2} 0 obj\n`);
      const stream = pdf.indexOf("stream\n", start) + "stream\n".length;
      // The JPEG's bytes as they came, tagged with the page's number
      expect(pdf.codePointAt(stream + 6)).toBe(index + 1);
      expect(pdf.slice(stream, stream + page.jpeg.length).length).toBe(
        page.jpeg.length
      );
    }
  });

  it("names the document in UTF-16", () => {
    expect(pdf).toMatch(/\/Title <FEFF004300610072006F/u);
    expect(pdf).toContain("2728>");
  });
});
