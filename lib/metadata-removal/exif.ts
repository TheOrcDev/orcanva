// EXIF is a TIFF directory of tagged values. Before dropping it, the readers
// want to know which way up the photo is and whether it says where it was
// taken.

const ORIENTATION_TAG = 0x01_12;
const GPS_DIRECTORY_TAG = 0x88_25;
const GPS_LATITUDE_TAG = 0x00_02;
const SHORT_TYPE = 3;
const ENTRY_SIZE = 12;
const UPRIGHT = 1;
const MAX_ORIENTATION = 8;

export interface ExifFacts {
  // 1 to 8; 1 is upright
  orientation: number;
  hasLocation: boolean;
  // Nothing but the orientation, which is what `orientationOnlyExif` writes
  orientationOnly: boolean;
}

const entriesAt = (view: DataView, offset: number, littleEndian: boolean) =>
  Array.from({ length: view.getUint16(offset, littleEndian) }, (_, index) => {
    const entry = offset + 2 + index * ENTRY_SIZE;
    return { tag: view.getUint16(entry, littleEndian), value: entry + 8 };
  });

export const readExif = (tiff: Uint8Array): ExifFacts => {
  const facts = {
    hasLocation: false,
    orientation: UPRIGHT,
    orientationOnly: false,
  };
  const view = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  try {
    // "II" for little-endian, "MM" for big-endian
    const littleEndian = view.getUint16(0) === 0x49_49;
    const first = view.getUint32(4, littleEndian);
    const entries = entriesAt(view, first, littleEndian);
    for (const { tag, value } of entries) {
      if (tag === ORIENTATION_TAG) {
        const orientation = view.getUint16(value, littleEndian);
        if (orientation >= UPRIGHT && orientation <= MAX_ORIENTATION) {
          facts.orientation = orientation;
        }
      }
      if (tag === GPS_DIRECTORY_TAG) {
        const gps = entriesAt(
          view,
          view.getUint32(value, littleEndian),
          littleEndian
        );
        facts.hasLocation = gps.some((entry) => entry.tag === GPS_LATITUDE_TAG);
      }
    }
    const next = view.getUint32(
      first + 2 + entries.length * ENTRY_SIZE,
      littleEndian
    );
    facts.orientationOnly =
      entries.length === 1 && entries[0]?.tag === ORIENTATION_TAG && next === 0;
  } catch {
    // A damaged directory points past its end: what was read so far stands
  }
  return facts;
};

// A TIFF directory with one entry, the orientation, so a sideways phone photo
// still shows the right way up once its EXIF is gone
export const orientationOnlyExif = (
  orientation: number
): Uint8Array<ArrayBuffer> => {
  // Header (8), entry count (2), the entry (12), next directory: none (4)
  const tiff = new Uint8Array(26);
  const view = new DataView(tiff.buffer);
  // "MM", 42: big-endian TIFF, its directory right after this header
  view.setUint32(0, 0x4d_4d_00_2a);
  view.setUint32(4, 8);
  view.setUint16(8, 1);
  view.setUint16(10, ORIENTATION_TAG);
  view.setUint16(12, SHORT_TYPE);
  view.setUint32(14, 1);
  view.setUint16(18, orientation);
  return tiff;
};
