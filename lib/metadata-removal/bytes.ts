// Byte helpers the JPEG, PNG and WebP readers share

// Every byte as one character, so ASCII markers can be searched for in
// binary data
const latin1 = new TextDecoder("latin1");
const utf8 = new TextDecoder();

// Whether `bytes` holds the ASCII `text` at `offset`
export const hasAscii = (
  bytes: Uint8Array,
  offset: number,
  text: string
): boolean =>
  offset + text.length <= bytes.length &&
  [...text].every(
    (char, index) => bytes[offset + index] === char.codePointAt(0)
  );

export const readAscii = (
  bytes: Uint8Array,
  offset: number,
  length: number
): string => latin1.decode(bytes.subarray(offset, offset + length));

// Whether the ASCII `text` appears anywhere in `bytes`
export const includesAscii = (bytes: Uint8Array, text: string): boolean =>
  latin1.decode(bytes).includes(text);

// XMP and PNG text notes, read as text (malformed bytes become U+FFFD)
export const readText = (bytes: Uint8Array): string => utf8.decode(bytes);

export const concat = (
  parts: readonly Uint8Array[]
): Uint8Array<ArrayBuffer> => {
  const joined = new Uint8Array(
    parts.reduce((total, part) => total + part.length, 0)
  );
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.length;
  }
  return joined;
};
