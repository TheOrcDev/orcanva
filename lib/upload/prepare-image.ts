import {
  MAX_UPLOAD_BYTES,
  UPLOAD_MIME_TYPES,
  isUploadMimeType,
} from "@/lib/storage/keys";
import type { UploadMimeType } from "@/lib/storage/keys";

// Thumbnails never need more; bigger images only cost memory and bandwidth
export const MAX_IMAGE_SIDE = 4096;
const REENCODE_QUALITY = 0.92;

export interface PreparedImage {
  blob: Blob;
  mimeType: UploadMimeType;
  width: number;
  height: number;
  sha256: string;
  name: string;
}

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

const SUPPORTED = Object.values(UPLOAD_MIME_TYPES)
  .map((extension) => extension.toUpperCase())
  .join(", ");

const toHex = (buffer: ArrayBuffer): string =>
  [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

const EXTENSION = /\.[^.]+$/u;

export const displayName = (fileName: string): string =>
  fileName.replace(EXTENSION, "").trim().slice(0, 120) || "Image";

const downscale = async (
  bitmap: ImageBitmap,
  mimeType: UploadMimeType
): Promise<{ blob: Blob; width: number; height: number }> => {
  const scale = MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new UploadError("Could not resize the image");
  }
  context.imageSmoothingQuality = "high";
  context.drawImage(bitmap, 0, 0, width, height);
  // Canvas can't encode GIF; PNG keeps any transparency
  const type = mimeType === "image/gif" ? "image/png" : mimeType;
  const blob = await canvas.convertToBlob({ quality: REENCODE_QUALITY, type });
  return { blob, height, width };
};

// Validates, reads dimensions, downscales oversized images, and hashes the
// final bytes (the hash dedupes identical uploads across designs).
export const prepareImage = async (file: File): Promise<PreparedImage> => {
  if (!isUploadMimeType(file.type)) {
    throw new UploadError(
      `${file.name}: only ${SUPPORTED} images are supported`
    );
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new UploadError(`${file.name} is larger than 25 MB`);
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new UploadError(`${file.name} could not be read as an image`);
  }

  try {
    let blob: Blob = file;
    let mimeType: UploadMimeType = file.type;
    let { height, width } = bitmap;
    if (Math.max(width, height) > MAX_IMAGE_SIDE) {
      ({ blob, height, width } = await downscale(bitmap, mimeType));
      if (mimeType === "image/gif") {
        mimeType = "image/png";
      }
    }
    const sha256 = toHex(
      await crypto.subtle.digest("SHA-256", await blob.arrayBuffer())
    );
    return {
      blob,
      height,
      mimeType,
      name: displayName(file.name),
      sha256,
      width,
    };
  } finally {
    bitmap.close();
  }
};
