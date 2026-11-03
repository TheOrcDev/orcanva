import type { Rect, Size } from "@/lib/document/geometry";
import {
  outlineCoverage,
  squaredSeedDistances,
} from "@/lib/photo-effects/distance";
import type { Color4 } from "@/lib/photo-effects/geometry";
import type { EffectsJob, EffectsOutput } from "@/lib/photo-effects/job";
import { drawPhotoMask } from "@/lib/photo-effects/mask";

// Photo effects for browsers without WebGL2, on 2D canvases: the outline
// from an exact distance transform on the CPU (the same edge as the GPU's),
// glows and shadows from canvas shadows. Slower, so only the fallback.

let maskCanvas: HTMLCanvasElement | null = null;
let silhouetteCanvas: HTMLCanvasElement | null = null;
let outlineCanvas: HTMLCanvasElement | null = null;

const sized = (canvas: HTMLCanvasElement | null, size: Size) => {
  const target = canvas ?? document.createElement("canvas");
  if (target.width !== size.width || target.height !== size.height) {
    target.width = size.width;
    target.height = size.height;
  } else {
    target.getContext("2d")?.clearRect(0, 0, size.width, size.height);
  }
  return target;
};

const release = (canvas: HTMLCanvasElement | null) => {
  if (canvas) {
    canvas.width = 0;
    canvas.height = 0;
  }
};

const css = ([red, green, blue, alpha]: Color4) =>
  `rgba(${Math.round(red * 255)}, ${Math.round(green * 255)}, ${Math.round(blue * 255)}, ${alpha})`;

// Back to straight colour from the premultiplied colours of the paint
const straight = ([red, green, blue, alpha]: Color4): Color4 =>
  alpha > 0 ? [red / alpha, green / alpha, blue / alpha, alpha] : [0, 0, 0, 0];

// The silhouette (photo and outline, in white) and the outline in its
// colour, from the mask's pixels
const silhouettes = (
  mask: HTMLCanvasElement,
  job: EffectsJob
): { silhouette: HTMLCanvasElement; outline: HTMLCanvasElement | null } => {
  const { size } = job.layout;
  const { outline } = job.paint;
  const pixels = mask
    .getContext("2d", { willReadFrequently: true })
    ?.getImageData(0, 0, size.width, size.height).data;
  const silhouette = sized(silhouetteCanvas, size);
  silhouetteCanvas = silhouette;
  if (!pixels) {
    return { outline: null, silhouette };
  }
  const distances = outline
    ? squaredSeedDistances(pixels, size.width, size.height)
    : null;
  const color = outline ? straight(outline.color) : null;
  const shape = new ImageData(size.width, size.height);
  const ring = outline ? new ImageData(size.width, size.height) : null;
  for (let index = 0; index < size.width * size.height; index += 1) {
    const alpha = (pixels[index * 4 + 3] ?? 0) / 255;
    const covered =
      distances && outline
        ? outlineCoverage(Math.sqrt(distances[index] ?? 0), outline.width)
        : 0;
    const at = index * 4;
    shape.data[at] = 255;
    shape.data[at + 1] = 255;
    shape.data[at + 2] = 255;
    shape.data[at + 3] = Math.max(alpha, covered) * 255;
    if (ring && color) {
      ring.data[at] = color[0] * 255;
      ring.data[at + 1] = color[1] * 255;
      ring.data[at + 2] = color[2] * 255;
      ring.data[at + 3] = color[3] * covered * 255;
    }
  }
  silhouette.getContext("2d")?.putImageData(shape, 0, 0);
  if (!ring) {
    return { outline: null, silhouette };
  }
  const outlined = sized(outlineCanvas, size);
  outlineCanvas = outlined;
  outlined.getContext("2d")?.putImageData(ring, 0, 0);
  return { outline: outlined, silhouette };
};

// Draws `source` blurred, in a colour, with its top-left at (x, y): it's
// drawn far to the left so only its canvas shadow lands. Canvas shadows
// ignore the transform, and none is set here, so the blur is in px.
const drawBlurred = (
  context: CanvasRenderingContext2D,
  source: HTMLCanvasElement,
  { x, y }: { x: number; y: number },
  color: Color4,
  sigma: number
) => {
  const away = source.width + context.canvas.width + 100;
  context.save();
  context.shadowColor = css(color);
  context.shadowBlur = sigma * 2;
  context.shadowOffsetX = away;
  context.drawImage(source, x - away, y);
  context.restore();
};

const fitTo = (canvas: HTMLCanvasElement, region: Rect) =>
  sized(canvas, { height: region.height, width: region.width });

// The mask is read back pixel by pixel, so its context says so up front
const readableCanvas = (): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.getContext("2d", { willReadFrequently: true });
  return canvas;
};

export const renderWithCanvas = (job: EffectsJob): EffectsOutput => {
  const { layout, paint } = job;
  maskCanvas = sized(maskCanvas ?? readableCanvas(), layout.size);
  drawPhotoMask(maskCanvas, job.mask, layout);
  const { outline, silhouette } = silhouettes(maskCanvas, job);

  const halo = layout.halo !== null && (paint.outline ?? paint.glow) !== null;
  if (layout.halo && halo) {
    const context = fitTo(job.halo, layout.halo).getContext("2d");
    const origin = { x: -layout.halo.x, y: -layout.halo.y };
    if (context && paint.glow) {
      // Twice over, as the shader doubles the blurred silhouette
      for (let pass = 0; pass < paint.glow.gain; pass += 1) {
        drawBlurred(
          context,
          silhouette,
          origin,
          straight(paint.glow.color),
          paint.glow.sigma
        );
      }
    }
    if (context && outline) {
      context.drawImage(outline, origin.x, origin.y);
    }
    // Hidden under the photo, as the shader does where it's opaque
    if (context && paint.opacity < 1) {
      context.globalCompositeOperation = "destination-out";
      context.drawImage(maskCanvas, origin.x, origin.y);
      context.globalCompositeOperation = "source-over";
    }
  }

  const shadow = layout.shadow !== null && paint.shadow !== null;
  if (layout.shadow && paint.shadow) {
    const context = fitTo(job.shadow, layout.shadow).getContext("2d");
    const origin = { x: -layout.shadow.x, y: -layout.shadow.y };
    if (context) {
      drawBlurred(
        context,
        silhouette,
        origin,
        paint.shadow.color,
        paint.shadow.sigma
      );
    }
  }

  for (const canvas of [maskCanvas, silhouetteCanvas, outlineCanvas]) {
    release(canvas);
  }
  return { halo, shadow };
};
