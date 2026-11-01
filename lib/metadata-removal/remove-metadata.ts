import { cleanJpeg, isJpeg } from "@/lib/metadata-removal/jpeg";
import type { Cleaned, MetadataKind } from "@/lib/metadata-removal/metadata";
import { cleanPng, isPng } from "@/lib/metadata-removal/png";
import { cleanWebp, isWebp } from "@/lib/metadata-removal/webp";

export type CleanFormat = "jpg" | "png" | "webp";

export interface CleanImage {
  blob: Blob;
  // What the file really is, whatever its name says
  format: CleanFormat;
  found: MetadataKind[];
  // Drawn again from its pixels, because it isn't a JPG, PNG or WebP that
  // could be cleaned in place: nothing but the picture is left, but a JPG
  // is compressed again
  redrawn: boolean;
}

const REDRAW_QUALITY = 0.95;

const FORMATS = [
  { clean: cleanJpeg, format: "jpg", is: isJpeg, type: "image/jpeg" },
  { clean: cleanPng, format: "png", is: isPng, type: "image/png" },
  { clean: cleanWebp, format: "webp", is: isWebp, type: "image/webp" },
] as const;

// Read by its bytes, since AI tools' downloads are often named for another
// format. Null when the file can't be cleaned in place.
const cleanInPlace = (bytes: Uint8Array) => {
  const reader = FORMATS.find((candidate) => candidate.is(bytes));
  if (!reader) {
    return null;
  }
  let cleaned: Cleaned;
  try {
    cleaned = reader.clean(bytes);
    // Read the result again: anything still there is something the reader
    // got wrong, and redrawing is the safe way out
    if (reader.clean(cleaned.bytes).found.length > 0) {
      return null;
    }
  } catch {
    return null;
  }
  return { ...cleaned, format: reader.format, type: reader.type };
};

// Like a screenshot: only the pixels survive
const redraw = async (image: Blob, asJpeg: boolean): Promise<CleanImage> => {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(image);
  } catch {
    throw new Error("This file couldn't be opened as an image");
  }
  try {
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("The image couldn't be redrawn");
    }
    context.drawImage(bitmap, 0, 0);
    const blob = await canvas.convertToBlob({
      quality: REDRAW_QUALITY,
      type: asJpeg ? "image/jpeg" : "image/png",
    });
    return { blob, format: asJpeg ? "jpg" : "png", found: [], redrawn: true };
  } finally {
    bitmap.close();
  }
};

// The same image without its metadata: Content Credentials, AI tags,
// prompts, EXIF and GPS, XMP and the rest. JPG, PNG and WebP keep every byte
// of their picture; anything else the browser can open is redrawn. Runs in
// the browser, so the image is never uploaded.
export const removeMetadata = async (image: Blob): Promise<CleanImage> => {
  const bytes = new Uint8Array(await image.arrayBuffer());
  const cleaned = cleanInPlace(bytes);
  if (!cleaned) {
    return redraw(image, isJpeg(bytes));
  }
  const { format, found, type } = cleaned;
  // Nothing to remove: the file as it came
  const blob = new Blob([found.length > 0 ? cleaned.bytes : bytes], { type });
  return { blob, format, found, redrawn: false };
};
