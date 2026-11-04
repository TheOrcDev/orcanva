// A small ZIP writer for downloading every page at once. Files are stored as
// they are (method 0, no compression): PNG, JPEG and WebP are compressed
// already, so deflating them again would only cost time. Loaded only when a
// download needs it.
//
// The format (PKWARE's APPNOTE): each file is a local header, its name and
// its bytes; then a central directory with a header per file pointing back
// at its local header; then the end-of-central-directory record pointing at
// the directory. All numbers are little-endian. This writes ZIP32, so the
// archive stays under 4 GiB and 65,535 files.

export interface ZipFile {
  name: string;
  data: Uint8Array;
  // Defaults to now
  modified?: Date;
}

const LOCAL_HEADER = 0x04_03_4b_50;
const CENTRAL_HEADER = 0x02_01_4b_50;
const END_OF_DIRECTORY = 0x06_05_4b_50;
const LOCAL_HEADER_SIZE = 30;
const CENTRAL_HEADER_SIZE = 46;
const END_SIZE = 22;
// 2.0: what's needed to read a stored file in a directory-less archive
const VERSION = 20;
// General purpose flag bit 11: names are UTF-8
const UTF8_NAMES = 0x08_00;
const STORED = 0;
const MAX_ZIP32 = 0xff_ff_ff_ff;
const MAX_FILES = 0xff_ff;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      // oxlint-disable-next-line no-bitwise -- CRC-32 is bit arithmetic
      value = value & 1 ? 0xed_b8_83_20 ^ (value >>> 1) : value >>> 1;
    }
    // A Uint32Array keeps it unsigned
    table[index] = value;
  }
  return table;
})();

// CRC-32 (the ZIP and PNG one: reflected, polynomial 0xEDB88320)
export const crc32 = (data: Uint8Array): number => {
  let crc = 0xff_ff_ff_ff;
  for (const byte of data) {
    // oxlint-disable-next-line no-bitwise -- CRC-32 is bit arithmetic
    crc = (CRC_TABLE[(crc ^ byte) & 0xff] ?? 0) ^ (crc >>> 8);
  }
  // oxlint-disable-next-line no-bitwise -- CRC-32 is bit arithmetic
  return (crc ^ 0xff_ff_ff_ff) >>> 0;
};

// MS-DOS date and time, in local time, as ZIP stores them (two-second
// steps, years from 1980)
const dosTime = (date: Date): { time: number; day: number } => {
  const year = Math.min(Math.max(date.getFullYear(), 1980), 2107);
  return {
    day: (year - 1980) * 512 + (date.getMonth() + 1) * 32 + date.getDate(),
    time:
      date.getHours() * 2048 +
      date.getMinutes() * 32 +
      Math.floor(date.getSeconds() / 2),
  };
};

interface Prepared {
  name: Uint8Array;
  data: Uint8Array;
  crc: number;
  time: number;
  day: number;
  offset: number;
}

const localHeader = (file: Prepared): Uint8Array => {
  const bytes = new Uint8Array(LOCAL_HEADER_SIZE + file.name.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, LOCAL_HEADER, true);
  view.setUint16(4, VERSION, true);
  view.setUint16(6, UTF8_NAMES, true);
  view.setUint16(8, STORED, true);
  view.setUint16(10, file.time, true);
  view.setUint16(12, file.day, true);
  view.setUint32(14, file.crc, true);
  view.setUint32(18, file.data.length, true);
  view.setUint32(22, file.data.length, true);
  view.setUint16(26, file.name.length, true);
  view.setUint16(28, 0, true);
  bytes.set(file.name, LOCAL_HEADER_SIZE);
  return bytes;
};

const centralHeader = (file: Prepared): Uint8Array => {
  const bytes = new Uint8Array(CENTRAL_HEADER_SIZE + file.name.length);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, CENTRAL_HEADER, true);
  view.setUint16(4, VERSION, true);
  view.setUint16(6, VERSION, true);
  view.setUint16(8, UTF8_NAMES, true);
  view.setUint16(10, STORED, true);
  view.setUint16(12, file.time, true);
  view.setUint16(14, file.day, true);
  view.setUint32(16, file.crc, true);
  view.setUint32(20, file.data.length, true);
  view.setUint32(24, file.data.length, true);
  view.setUint16(28, file.name.length, true);
  // Extra field, comment, disk number, internal and external attributes
  // are all zero
  view.setUint32(42, file.offset, true);
  bytes.set(file.name, CENTRAL_HEADER_SIZE);
  return bytes;
};

const endOfDirectory = (
  count: number,
  size: number,
  offset: number
): Uint8Array => {
  const bytes = new Uint8Array(END_SIZE);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, END_OF_DIRECTORY, true);
  view.setUint16(8, count, true);
  view.setUint16(10, count, true);
  view.setUint32(12, size, true);
  view.setUint32(16, offset, true);
  return bytes;
};

// The archive as parts in order (no copy of the files' bytes); a Blob of
// them is the .zip
export const zipParts = (files: readonly ZipFile[]): Uint8Array[] => {
  if (files.length > MAX_FILES) {
    throw new RangeError("Too many files for one ZIP");
  }
  const encoder = new TextEncoder();
  const parts: Uint8Array[] = [];
  const prepared: Prepared[] = [];
  let offset = 0;
  for (const file of files) {
    const { day, time } = dosTime(file.modified ?? new Date());
    const entry = {
      crc: crc32(file.data),
      data: file.data,
      day,
      name: encoder.encode(file.name),
      offset,
      time,
    };
    const header = localHeader(entry);
    parts.push(header, file.data);
    prepared.push(entry);
    offset += header.length + file.data.length;
  }
  const directoryOffset = offset;
  for (const entry of prepared) {
    const header = centralHeader(entry);
    parts.push(header);
    offset += header.length;
  }
  if (offset > MAX_ZIP32) {
    throw new RangeError("The ZIP would be over 4 GB");
  }
  parts.push(
    endOfDirectory(prepared.length, offset - directoryOffset, directoryOffset)
  );
  return parts;
};

export const zipBlob = (files: readonly ZipFile[]): Blob =>
  new Blob(zipParts(files) as BlobPart[], { type: "application/zip" });
