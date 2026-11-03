import { runAiTask } from "@/lib/ai/client";
import type { AiProgress } from "@/lib/ai/client";
import {
  contextRect,
  cropMask,
  cropPixels,
  dilate,
  holeRadius,
  maskBounds,
  pasteBack,
} from "@/lib/magic-eraser/mask";
import type { Mask, PixelRect } from "@/lib/magic-eraser/mask";
import type { Stroke } from "@/lib/magic-eraser/session";
import { bleedEdges } from "@/lib/upscale/encode";

// The magic eraser in the browser, shared by the editor's erase mode and the
// free /magic-eraser page

// What one erase changed: that part of the photo before and after, so undo
// and redo just put one or the other back
export interface ErasePatch {
  rect: PixelRect;
  before: Uint8ClampedArray<ArrayBuffer>;
  after: Uint8ClampedArray<ArrayBuffer>;
}

// Draws brush strokes as round lines (a single point is a dot)
export const drawStrokes = (
  context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D,
  strokes: readonly Stroke[]
): void => {
  context.lineCap = "round";
  context.lineJoin = "round";
  for (const { points, radius } of strokes) {
    const [first, ...rest] = points;
    if (!first) {
      continue;
    }
    context.beginPath();
    context.lineWidth = radius * 2;
    context.moveTo(first.x, first.y);
    for (const point of rest.length > 0 ? rest : [first]) {
      context.lineTo(point.x, point.y);
    }
    context.stroke();
  }
};

// The strokes as a mask of the photo's size; their soft edges count
export const strokeMask = (
  strokes: readonly Stroke[],
  width: number,
  height: number
): Mask => {
  const context = new OffscreenCanvas(width, height).getContext("2d");
  if (!context) {
    throw new Error("Could not draw the brush strokes");
  }
  context.strokeStyle = "#000";
  drawStrokes(context, strokes);
  const pixels = context.getImageData(0, 0, width, height).data;
  const data = new Uint8Array(width * height);
  for (let pixel = 0; pixel < data.length; pixel += 1) {
    data[pixel] = pixels[pixel * 4 + 3] ?? 0;
  }
  return { data, height, width };
};

// Fills what `mask` paints in `photo` (in place) with LaMa and returns what
// changed, or null when nothing was painted. Only the area around the
// strokes goes to the model, and only the painted pixels (grown a little)
// change; the photo keeps its own transparency.
export const fillMasked = async (
  photo: ImageData,
  mask: Mask,
  onProgress?: (progress: AiProgress) => void
): Promise<ErasePatch | null> => {
  const bounds = maskBounds(mask);
  if (!bounds) {
    return null;
  }
  const rect = contextRect(bounds, photo);
  const hole = dilate(cropMask(mask, rect), holeRadius(rect));
  const before = cropPixels(photo, rect);
  // A copy for the model, whose buffer goes to the worker
  const pixels = new Uint8ClampedArray(before);
  // The model sees colour only: clear pixels take their visible neighbours'
  // colour, so the black under a cutout's transparency doesn't bleed in
  bleedEdges(pixels, rect.width, rect.height);
  const filled = await runAiTask(
    {
      image: new ImageData(pixels, rect.width, rect.height),
      kind: "inpaint",
      mask: hole.data,
    },
    onProgress,
    [pixels.buffer]
  );
  pasteBack(photo, filled.data, hole, rect);
  return { after: cropPixels(photo, rect), before, rect };
};

// Puts one side of a patch back into the photo (in place)
export const applyPatch = (
  photo: ImageData,
  { rect, ...sides }: ErasePatch,
  side: "before" | "after"
): void => {
  const pixels = sides[side];
  for (let row = 0; row < rect.height; row += 1) {
    photo.data.set(
      pixels.subarray(row * rect.width * 4, (row + 1) * rect.width * 4),
      ((rect.y + row) * photo.width + rect.x) * 4
    );
  }
};
