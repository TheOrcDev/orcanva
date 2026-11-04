import { describe, expect, it } from "vitest";

import { crc32, zipParts } from "@/lib/export/zip";

const bytes = (text: string) => new TextEncoder().encode(text);

const join = (parts: readonly Uint8Array[]): Uint8Array => {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(total);
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
};

const MODIFIED = new Date(2026, 10, 4, 13, 37, 42);

describe("crc32", () => {
  it("matches the standard check value", () => {
    expect(crc32(bytes("123456789")).toString(16)).toBe("cbf43926");
    expect(crc32(new Uint8Array())).toBe(0);
  });
});

describe("zipParts", () => {
  const files = [
    { data: bytes("first page"), modified: MODIFIED, name: "carousel-01.png" },
    { data: bytes("second"), modified: MODIFIED, name: "carousel-02.png" },
  ];
  const zip = join(zipParts(files));
  const view = new DataView(zip.buffer);
  const end = zip.length - 22;

  it("ends with a directory record pointing at the central directory", () => {
    expect(view.getUint32(end, true)).toBe(0x06_05_4b_50);
    expect(view.getUint16(end + 8, true)).toBe(2);
    expect(view.getUint16(end + 10, true)).toBe(2);
    const size = view.getUint32(end + 12, true);
    const offset = view.getUint32(end + 16, true);
    expect(offset + size).toBe(end);
    expect(view.getUint32(offset, true)).toBe(0x02_01_4b_50);
  });

  it("points each directory entry at its file's local header", () => {
    const offset = view.getUint32(end + 16, true);
    let at = offset;
    const decoder = new TextDecoder();
    for (const file of files) {
      expect(view.getUint32(at, true)).toBe(0x02_01_4b_50);
      // Stored, UTF-8 names
      expect(view.getUint16(at + 8, true)).toBe(0x08_00);
      expect(view.getUint16(at + 10, true)).toBe(0);
      expect(view.getUint32(at + 16, true)).toBe(crc32(file.data));
      expect(view.getUint32(at + 20, true)).toBe(file.data.length);
      const nameLength = view.getUint16(at + 28, true);
      expect(decoder.decode(zip.subarray(at + 46, at + 46 + nameLength))).toBe(
        file.name
      );
      const local = view.getUint32(at + 42, true);
      expect(view.getUint32(local, true)).toBe(0x04_03_4b_50);
      expect(view.getUint32(local + 14, true)).toBe(crc32(file.data));
      const localName = view.getUint16(local + 26, true);
      const start = local + 30 + localName;
      expect(
        decoder.decode(zip.subarray(start, start + file.data.length))
      ).toBe(decoder.decode(file.data));
      at += 46 + nameLength;
    }
    expect(at).toBe(end);
  });

  it("stores the time in MS-DOS form", () => {
    // 13:37:42 → hours 13, minutes 37, seconds 42 / 2
    expect(view.getUint16(10, true)).toBe(13 * 2048 + 37 * 32 + 21);
    // 2026-11-04 → years since 1980, month, day
    expect(view.getUint16(12, true)).toBe((2026 - 1980) * 512 + 11 * 32 + 4);
  });

  it("writes an empty archive as just the directory record", () => {
    const empty = join(zipParts([]));
    expect(empty).toHaveLength(22);
    expect(new DataView(empty.buffer).getUint32(0, true)).toBe(0x06_05_4b_50);
  });
});
