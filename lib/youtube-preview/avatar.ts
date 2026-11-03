import { squareCrop } from "@/lib/upload/prepare-avatar";
import { UploadError } from "@/lib/upload/prepare-image";

// Channel pictures show at 24 to 40 CSS px; 88 stays sharp on 2× screens
const CHANNEL_AVATAR_SIZE = 88;
const CHANNEL_AVATAR_QUALITY = 0.85;
// JPEG has no transparency: see-through pixels become white, not black
const CHANNEL_AVATAR_BACKDROP = "#ffffff";

// A channel picture for the preview, made in the browser and never
// uploaded: the middle square of the image as a small JPEG data URL, small
// enough to keep in localStorage
export const channelAvatar = async (file: File): Promise<string> => {
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
    const canvas = document.createElement("canvas");
    canvas.width = CHANNEL_AVATAR_SIZE;
    canvas.height = CHANNEL_AVATAR_SIZE;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new UploadError("Could not resize the image");
    }
    context.fillStyle = CHANNEL_AVATAR_BACKDROP;
    context.fillRect(0, 0, CHANNEL_AVATAR_SIZE, CHANNEL_AVATAR_SIZE);
    context.imageSmoothingQuality = "high";
    context.drawImage(
      bitmap,
      x,
      y,
      side,
      side,
      0,
      0,
      CHANNEL_AVATAR_SIZE,
      CHANNEL_AVATAR_SIZE
    );
    return canvas.toDataURL("image/jpeg", CHANNEL_AVATAR_QUALITY);
  } finally {
    bitmap.close();
  }
};
