import { UploadError } from "@/lib/upload/prepare-image";

// Shown at 24 to 80 CSS px; 256 stays sharp on 3× screens
export const AVATAR_SIZE = 256;
const AVATAR_QUALITY = 0.9;
// JPEG has no transparency: see-through pixels become white, not black
const AVATAR_BACKDROP = "#ffffff";

// The largest centred square, in source pixels
export const squareCrop = (
  width: number,
  height: number
): { x: number; y: number; side: number } => {
  const side = Math.min(width, height);
  return {
    side,
    x: Math.round((width - side) / 2),
    y: Math.round((height - side) / 2),
  };
};

// Crops any image the browser can read to a centred square and shrinks it
// to a small JPEG, so the server only ever stores one size of one format
export const prepareAvatar = async (file: File): Promise<Blob> => {
  if (!file.type.startsWith("image/")) {
    throw new UploadError(`${file.name} isn't an image`);
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new UploadError(`${file.name} could not be read as an image`);
  }
  try {
    const { side, x, y } = squareCrop(bitmap.width, bitmap.height);
    const canvas = new OffscreenCanvas(AVATAR_SIZE, AVATAR_SIZE);
    const context = canvas.getContext("2d");
    if (!context) {
      throw new UploadError("Could not resize the image");
    }
    context.fillStyle = AVATAR_BACKDROP;
    context.fillRect(0, 0, AVATAR_SIZE, AVATAR_SIZE);
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, x, y, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
    return await canvas.convertToBlob({
      quality: AVATAR_QUALITY,
      type: "image/jpeg",
    });
  } finally {
    bitmap.close();
  }
};
