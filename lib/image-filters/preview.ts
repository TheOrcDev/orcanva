import { NEUTRAL_ADJUSTMENTS } from "@/lib/image-filters/adjustments";
import { renderFilter } from "@/lib/image-filters/renderer";
import { resolveFilter, toUniforms } from "@/lib/image-filters/resolve";

// Tiles are about 72 CSS px wide; twice that stays sharp on retina
export const PRESET_PREVIEW_SIZE = 144;

// One small square crop per photo, shared by every tile (and so by one
// GPU texture)
const crops = new WeakMap<HTMLImageElement, HTMLCanvasElement>();

const squareCrop = (image: HTMLImageElement): HTMLCanvasElement => {
  const cached = crops.get(image);
  if (cached) {
    return cached;
  }
  const canvas = document.createElement("canvas");
  canvas.width = PRESET_PREVIEW_SIZE;
  canvas.height = PRESET_PREVIEW_SIZE;
  const context = canvas.getContext("2d");
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  if (context) {
    context.imageSmoothingQuality = "high";
    context.drawImage(
      image,
      (image.naturalWidth - side) / 2,
      (image.naturalHeight - side) / 2,
      side,
      side,
      0,
      0,
      PRESET_PREVIEW_SIZE,
      PRESET_PREVIEW_SIZE
    );
  }
  crops.set(image, canvas);
  return canvas;
};

// The photo through a preset at full intensity, like Instagram's strip;
// null (Original) or a browser without WebGL2 shows it unfiltered
export const drawPresetPreview = (
  image: HTMLImageElement,
  preset: string | null,
  target: HTMLCanvasElement
) => {
  const crop = squareCrop(image);
  const resolved = resolveFilter(
    preset ? { adjust: NEUTRAL_ADJUSTMENTS, preset, strength: 100 } : null
  );
  if (resolved && renderFilter(crop, toUniforms(resolved), target)) {
    return;
  }
  const context = target.getContext("2d");
  context?.clearRect(0, 0, target.width, target.height);
  context?.drawImage(crop, 0, 0, target.width, target.height);
};
