import {
  AutoModel,
  AutoProcessor,
  LogLevel,
  PretrainedConfig,
  RawImage,
  Tensor,
  env,
} from "@huggingface/transformers";
import type {
  PreTrainedModel,
  Processor,
  ProgressInfo,
} from "@huggingface/transformers";

import { backendChoices, unsupportedReason } from "@/lib/ai/backend";
import type { Backend, GpuSupport } from "@/lib/ai/backend";
import { MODELS } from "@/lib/ai/models";
import type { ModelId } from "@/lib/ai/models";
import { applyMask, toRgb } from "@/lib/background-removal/compose";
import { MAX_UPLOAD_BYTES } from "@/lib/storage/keys";
import {
  alphaAsGrey,
  bleedEdges,
  encodeOptions,
  hasTransparency,
  restoreAlpha,
} from "@/lib/upscale/encode";
import {
  blendTile,
  featherEdges,
  outputRect,
  tileGrid,
} from "@/lib/upscale/tiles";
import type { Tile } from "@/lib/upscale/tiles";

// One worker runs every model in lib/ai/models.ts, one image at a time:
// parallel runs only fight over the same GPU. Models load on first use and
// stay warm for the next image.

// Model files come from the Hugging Face hub, never this app's origin
env.allowLocalModels = false;
// Transformers.js warns about every model type it doesn't know, which is
// every bare ONNX repo here
env.logLevel = LogLevel.ERROR;

export type AiTask =
  | { kind: "cutout"; image: Blob }
  // Fills the pixels `mask` paints (one byte per pixel, above 0 to fill)
  | { kind: "inpaint"; image: ImageData; mask: Uint8Array }
  // To exactly this size, which may be less than 4× (see upscaleOptions)
  | { kind: "upscale"; image: Blob; width: number; height: number };

export type AiTaskKind = AiTask["kind"];

export interface AiResults {
  cutout: { png: Blob; width: number; height: number };
  // The picture with the hole filled, opaque, at its own size
  inpaint: ImageData;
  // A JPEG, or a PNG when the photo has transparency
  upscale: { blob: Blob; width: number; height: number };
}

export interface AiRequest {
  id: number;
  task: AiTask;
}

// "download" is the model's first download (or its read from the cache),
// "work" the image itself where a task can tell
export interface AiProgress {
  stage: "download" | "work";
  percent: number;
}

export type AiMessage =
  | { id: number; type: "progress"; progress: AiProgress }
  | { id: number; type: "done"; result: AiResults[AiTaskKind] }
  | { id: number; type: "error"; message: string };

interface ModelSession {
  inputNames: string[];
  outputNames: string[];
}

interface LoadedModel {
  backend: Backend;
  model: PreTrainedModel;
}

// The slice of the WebGPU API used here (TypeScript's DOM lib lacks it)
interface WebGpu {
  requestAdapter: () => Promise<{ features: ReadonlySet<string> } | null>;
}

const reply = (message: AiMessage, transfer: Transferable[] = []) =>
  postMessage(message, { transfer });

// Jobs run one at a time, so progress belongs to the current one
let activeJob = 0;

const reportWork = (percent: number) =>
  reply({
    id: activeJob,
    progress: { percent, stage: "work" },
    type: "progress",
  });

// Each model is one ONNX file, so that file's download is the model's.
// Transformers.js only adds files up for repos laid out its own way, which
// LaMa's isn't.
const onProgress = (info: ProgressInfo) => {
  if (info.status === "progress" && info.file.endsWith(".onnx")) {
    reply({
      id: activeJob,
      progress: { percent: info.progress, stage: "download" },
      type: "progress",
    });
  }
};

let support: Promise<GpuSupport> | undefined;

const gpuSupport = (): Promise<GpuSupport> => {
  support ??= (async () => {
    const { gpu } = navigator as Navigator & { gpu?: WebGpu };
    const adapter = await gpu?.requestAdapter().catch(() => null);
    return {
      f16: adapter?.features.has("shader-f16") ?? false,
      webgpu: Boolean(adapter),
    };
  })();
  return support;
};

// Backends a model failed on (a shader that won't compile, a lost device):
// it moves on to its next choice and stays there for this tab
const failedBackends = new Set<string>();
const backendKey = (id: ModelId, { device, dtype }: Backend) =>
  `${id}:${device}:${dtype}`;

const loadOn = (id: ModelId, backend: Backend) => {
  const spec = MODELS[id];
  return AutoModel.from_pretrained(spec.repo, {
    config: spec.config ? new PretrainedConfig(spec.config) : undefined,
    device: backend.device,
    dtype: backend.dtype,
    model_file_name: spec.file,
    progress_callback: onProgress,
    revision: spec.revision,
    session_options: spec.sessionOptions ?? {},
    subfolder: spec.subfolder,
  });
};

const models = new Map<ModelId, Promise<LoadedModel>>();

const unload = async (id: ModelId) => {
  const entry = models.get(id);
  models.delete(id);
  const loaded = await entry?.catch(() => null);
  await loaded?.model.dispose();
};

const loadModel = (id: ModelId): Promise<LoadedModel> => {
  const existing = models.get(id);
  if (existing) {
    return existing;
  }
  const attempt = (async () => {
    // Two big models at once can run a GPU out of memory
    if (MODELS[id].heavy) {
      const others = [...models.keys()].filter(
        (other) => other !== id && MODELS[other].heavy
      );
      await Promise.all(others.map(unload));
    }
    const available = await gpuSupport();
    const choices = backendChoices(MODELS[id], available).filter(
      (backend) => !failedBackends.has(backendKey(id, backend))
    );
    if (choices.length === 0) {
      throw new Error(unsupportedReason(available));
    }
    let failure: unknown;
    for (const backend of choices) {
      try {
        // oxlint-disable-next-line no-await-in-loop -- one backend at a time
        return { backend, model: await loadOn(id, backend) };
      } catch (error) {
        failedBackends.add(backendKey(id, backend));
        failure = error;
      }
    }
    throw failure;
  })();
  // A failed download should be retried on the next request
  attempt.catch(() => {
    if (models.get(id) === attempt) {
      models.delete(id);
    }
  });
  models.set(id, attempt);
  return attempt;
};

// Runs `run` with the model loaded. When the GPU fails it (WebGPU compiles
// its shaders on the first run), the model reloads on its next backend and
// `run` goes again there.
const withModel = async <T>(
  id: ModelId,
  run: (model: PreTrainedModel) => Promise<T>
): Promise<T> => {
  const { backend, model } = await loadModel(id);
  try {
    return await run(model);
  } catch (error) {
    if (backend.device !== "webgpu") {
      throw error;
    }
    failedBackends.add(backendKey(id, backend));
    await unload(id);
    const next = await loadModel(id).catch(() => {
      throw error;
    });
    return run(next.model);
  }
};

const readPixels = async (image: Blob): Promise<ImageData> => {
  // Decoded EXIF-rotated, the way the editor shows it
  const bitmap = await createImageBitmap(image);
  try {
    const context = new OffscreenCanvas(bitmap.width, bitmap.height).getContext(
      "2d"
    );
    if (!context) {
      throw new Error("Could not read the image");
    }
    context.drawImage(bitmap, 0, 0);
    return context.getImageData(0, 0, bitmap.width, bitmap.height);
  } finally {
    bitmap.close();
  }
};

let ben2Processor: Promise<Processor> | undefined;

const loadBen2Processor = (): Promise<Processor> => {
  if (!ben2Processor) {
    const { repo, revision } = MODELS.ben2;
    const attempt = AutoProcessor.from_pretrained(repo, { revision });
    attempt.catch(() => {
      ben2Processor = undefined;
    });
    ben2Processor = attempt;
  }
  return ben2Processor;
};

// BEN2 at its fixed 1024px input: a mask of the subject, applied to the
// photo at its own size
const cutOut = async (image: Blob): Promise<AiResults["cutout"]> => {
  const [processor, pixels] = await Promise.all([
    loadBen2Processor(),
    readPixels(image),
  ]);
  const { height, width } = pixels;
  const rgba = new Uint8Array(pixels.data.buffer);
  const { pixel_values: pixelValues } = await processor(
    new RawImage(toRgb(rgba), width, height, 3)
  );
  const prediction = await withModel("ben2", async (model) => {
    // Read the session's own input and output names, like the
    // background-removal pipeline does
    const {
      inputNames: [input = "pixel_values"],
      outputNames: [output = ""],
    } = model.sessions.model as ModelSession;
    const outputs = (await model({ [input]: pixelValues })) as Record<
      string,
      Tensor
    >;
    return outputs[output];
  });
  if (!prediction) {
    throw new Error("The AI model returned no mask");
  }
  let mask = prediction.squeeze(0).to("float32");
  // Probabilities are used as is; logits go through a sigmoid first
  if (mask.data.some((value) => value < 0 || value > 1)) {
    mask = mask.sigmoid();
  }
  const resized = await RawImage.fromTensor(mask.mul(255).to("uint8")).resize(
    width,
    height
  );

  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not draw the cutout");
  }
  pixels.data.set(applyMask(rgba, resized.data));
  context.putImageData(pixels, 0, 0);
  const png = await canvas.convertToBlob({ type: "image/png" });
  return { height, png, width };
};

// One tile as the upscaler's input: planar RGB in 0…1
const tileInput = ({ data, width }: ImageData, tile: Tile): Tensor => {
  const plane = tile.width * tile.height;
  const values = new Float32Array(plane * 3);
  for (let row = 0; row < tile.height; row += 1) {
    for (let column = 0; column < tile.width; column += 1) {
      const from = ((tile.y + row) * width + tile.x + column) * 4;
      const to = row * tile.width + column;
      values[to] = (data[from] ?? 0) / 255;
      values[plane + to] = (data[from + 1] ?? 0) / 255;
      values[plane * 2 + to] = (data[from + 2] ?? 0) / 255;
    }
  }
  return new Tensor("float32", values, [1, 3, tile.height, tile.width]);
};

// The upscaler's output as opaque RGBA, scaled to the size it fills (the
// model always makes 4×; 2× and capped sizes shrink each tile)
const tileOutput = (
  output: Tensor,
  width: number,
  height: number
): Uint8ClampedArray<ArrayBuffer> => {
  const outHeight = output.dims[2] ?? 0;
  const outWidth = output.dims[3] ?? 0;
  const plane = outWidth * outHeight;
  const values = output.data as Float32Array;
  // Uint8ClampedArray rounds and clamps the few values outside 0…1
  const rgba = new Uint8ClampedArray(plane * 4);
  for (let pixel = 0; pixel < plane; pixel += 1) {
    rgba[pixel * 4] = (values[pixel] ?? 0) * 255;
    rgba[pixel * 4 + 1] = (values[plane + pixel] ?? 0) * 255;
    rgba[pixel * 4 + 2] = (values[plane * 2 + pixel] ?? 0) * 255;
    rgba[pixel * 4 + 3] = 255;
  }
  if (outWidth === width && outHeight === height) {
    return rgba;
  }
  const full = new OffscreenCanvas(outWidth, outHeight);
  full.getContext("2d")?.putImageData(new ImageData(rgba, outWidth), 0, 0);
  const context = new OffscreenCanvas(width, height).getContext("2d");
  if (!context) {
    throw new Error("Could not resize the image");
  }
  context.imageSmoothingQuality = "high";
  context.drawImage(full, 0, 0, width, height);
  return context.getImageData(0, 0, width, height).data;
};

// Upscales the colour of `pixels` to width × height, tile by tile
const upscalePixels = async (
  pixels: ImageData,
  width: number,
  height: number,
  onTile: () => void
): Promise<Uint8ClampedArray<ArrayBuffer>> => {
  const tiles = tileGrid(pixels.width, pixels.height);
  const scaleX = width / pixels.width;
  const scaleY = height / pixels.height;
  const output = { data: new Uint8ClampedArray(width * height * 4), width };
  for (const tile of tiles) {
    // oxlint-disable-next-line no-await-in-loop -- one tile at a time keeps GPU memory flat
    const result = await withModel("realesrgan", async (model) => {
      const {
        inputNames: [input = "input"],
        outputNames: [name = "output"],
      } = model.sessions.model as ModelSession;
      const outputs = (await model({
        [input]: tileInput(pixels, tile),
      })) as Record<string, Tensor>;
      const upscaled = outputs[name];
      if (!upscaled) {
        throw new Error("The AI model returned no image");
      }
      return upscaled;
    });
    const rect = outputRect(tile, scaleX, scaleY);
    blendTile(
      output,
      tileOutput(result, rect.width, rect.height),
      rect,
      featherEdges(tile, tiles, scaleX, scaleY)
    );
    onTile();
  }
  return output.data;
};

const encode = async (
  rgba: Uint8ClampedArray<ArrayBuffer>,
  width: number,
  height: number,
  transparent: boolean
): Promise<Blob> => {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not draw the upscaled image");
  }
  context.putImageData(new ImageData(rgba, width), 0, 0);
  const blob = await canvas.convertToBlob(encodeOptions(transparent));
  if (blob.size <= MAX_UPLOAD_BYTES || !transparent) {
    return blob;
  }
  // A big transparent PNG can pass the upload limit; WebP keeps the
  // transparency far smaller where the browser can write it
  const webp = await canvas.convertToBlob({
    quality: 0.92,
    type: "image/webp",
  });
  if (webp.type === "image/webp" && webp.size <= MAX_UPLOAD_BYTES) {
    return webp;
  }
  throw new Error("The upscaled image is over 25 MB. Try a smaller size.");
};

// Real-ESRGAN at 4×, scaled to the size asked for. Transparency goes
// through the model too, as a grey picture, so a cutout's edge stays sharp.
const upscale = async ({
  height,
  image,
  width,
}: Extract<AiTask, { kind: "upscale" }>): Promise<AiResults["upscale"]> => {
  const pixels = await readPixels(image);
  const transparent = hasTransparency(pixels.data);
  const grey = transparent
    ? new ImageData(alphaAsGrey(pixels.data), pixels.width)
    : null;
  if (transparent) {
    bleedEdges(pixels.data, pixels.width, pixels.height);
  }
  const total = tileGrid(pixels.width, pixels.height).length * (grey ? 2 : 1);
  let done = 0;
  const onTile = () => {
    done += 1;
    reportWork((done / total) * 100);
  };
  const rgba = await upscalePixels(pixels, width, height, onTile);
  if (grey) {
    restoreAlpha(rgba, await upscalePixels(grey, width, height, onTile));
  }
  const blob = await encode(rgba, width, height, transparent);
  return { blob, height, width };
};

// Opaque RGBA from a model's planar RGB output, scaled by `scale` (255 for
// outputs in 0…1, 1 for ones already in 0…255)
const fromPlanar = (
  values: ArrayLike<number>,
  width: number,
  height: number,
  scale: number
): ImageData => {
  const plane = width * height;
  // Uint8ClampedArray rounds and clamps
  const rgba = new Uint8ClampedArray(plane * 4);
  for (let pixel = 0; pixel < plane; pixel += 1) {
    rgba[pixel * 4] = (values[pixel] ?? 0) * scale;
    rgba[pixel * 4 + 1] = (values[plane + pixel] ?? 0) * scale;
    rgba[pixel * 4 + 2] = (values[plane * 2 + pixel] ?? 0) * scale;
    rgba[pixel * 4 + 3] = 255;
  }
  return new ImageData(rgba, width, height);
};

// Pixels redrawn at another size with the browser's best smoothing
const resizePixels = (
  image: ImageData,
  width: number,
  height: number
): ImageData => {
  const source = new OffscreenCanvas(image.width, image.height);
  source.getContext("2d")?.putImageData(image, 0, 0);
  const context = new OffscreenCanvas(width, height).getContext("2d");
  if (!context) {
    throw new Error("Could not resize the image");
  }
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0, width, height);
  return context.getImageData(0, 0, width, height);
};

// Runs the eraser's model on its two inputs and returns its one output
const runInpaint = (inputs: { image: Tensor; mask: Tensor }): Promise<Tensor> =>
  withModel("lama", async (model) => {
    const {
      outputNames: [name = ""],
    } = model.sessions.model as ModelSession;
    const outputs = (await model(inputs)) as Record<string, Tensor>;
    const output = outputs[name];
    if (!output) {
      throw new Error("The AI model returned no image");
    }
    return output;
  });

// LaMa only takes 512 × 512. The picture is scaled to fit at its own shape
// and the rest of the square is filled by mirroring it, so nothing gets
// squashed; every pixel the brush touched counts as hole, soft edges
// included, or LaMa spreads the object's edge into it.
const LAMA_SIDE = 512;

// Draws `source` repeatedly across `size`, every other copy mirrored, so
// the edges meet seamlessly
const mirrorFill = (
  source: OffscreenCanvas,
  width: number,
  height: number
): OffscreenCanvas => {
  const canvas = new OffscreenCanvas(width, height);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Could not prepare the image");
  }
  for (let y = 0; y < height; y += source.height) {
    for (let x = 0; x < width; x += source.width) {
      const flipX = Math.round(x / source.width) % 2 === 1;
      const flipY = Math.round(y / source.height) % 2 === 1;
      context.save();
      context.translate(
        flipX ? x + source.width : x,
        flipY ? y + source.height : y
      );
      context.scale(flipX ? -1 : 1, flipY ? -1 : 1);
      context.drawImage(source, 0, 0);
      context.restore();
    }
  }
  return canvas;
};

// The picture fitted into the model's square at its own shape, mirrored
// beyond its edges; `width` and `height` are the part that's the picture
const toSquare = (image: ImageData) => {
  const scale = LAMA_SIDE / Math.max(image.width, image.height);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const fitted = new OffscreenCanvas(width, height);
  fitted
    .getContext("2d")
    ?.putImageData(resizePixels(image, width, height), 0, 0);
  const square = mirrorFill(fitted, LAMA_SIDE, LAMA_SIDE).getContext("2d");
  if (!square) {
    throw new Error("Could not prepare the image");
  }
  return {
    height,
    pixels: square.getImageData(0, 0, LAMA_SIDE, LAMA_SIDE),
    width,
  };
};

const inpaintLama = async (image: ImageData, hole: Uint8Array) => {
  const { height, width } = image;
  const holeAlpha = new Uint8ClampedArray(width * height * 4);
  for (const [pixel, value] of hole.entries()) {
    holeAlpha[pixel * 4 + 3] = value;
  }
  const picture = toSquare(image);
  // Mirrored too, so the object's mirror images are filled as well
  const holes = toSquare(new ImageData(holeAlpha, width, height)).pixels;
  const plane = LAMA_SIDE * LAMA_SIDE;
  const rgb = new Float32Array(plane * 3);
  const mask = new Float32Array(plane);
  for (let pixel = 0; pixel < plane; pixel += 1) {
    rgb[pixel] = (picture.pixels.data[pixel * 4] ?? 0) / 255;
    rgb[plane + pixel] = (picture.pixels.data[pixel * 4 + 1] ?? 0) / 255;
    rgb[plane * 2 + pixel] = (picture.pixels.data[pixel * 4 + 2] ?? 0) / 255;
    mask[pixel] = (holes.data[pixel * 4 + 3] ?? 0) > 0 ? 1 : 0;
  }
  const output = await runInpaint({
    image: new Tensor("float32", rgb, [1, 3, LAMA_SIDE, LAMA_SIDE]),
    mask: new Tensor("float32", mask, [1, 1, LAMA_SIDE, LAMA_SIDE]),
  });
  const filled = new OffscreenCanvas(LAMA_SIDE, LAMA_SIDE);
  filled
    .getContext("2d")
    ?.putImageData(
      fromPlanar(output.data as Float32Array, LAMA_SIDE, LAMA_SIDE, 1),
      0,
      0
    );
  const context = new OffscreenCanvas(width, height).getContext("2d");
  if (!context) {
    throw new Error("Could not resize the image");
  }
  context.imageSmoothingQuality = "high";
  context.drawImage(
    filled,
    0,
    0,
    picture.width,
    picture.height,
    0,
    0,
    width,
    height
  );
  return context.getImageData(0, 0, width, height);
};

const runTask = (task: AiTask): Promise<AiResults[AiTaskKind]> => {
  switch (task.kind) {
    case "cutout": {
      return cutOut(task.image);
    }
    case "inpaint": {
      return inpaintLama(task.image, task.mask);
    }
    case "upscale": {
      return upscale(task);
    }
    default: {
      return task satisfies never;
    }
  }
};

const runJob = async ({ id, task }: AiRequest) => {
  activeJob = id;
  try {
    const result = await runTask(task);
    // A filled picture's pixels are handed over, not copied
    reply(
      { id, result, type: "done" },
      result instanceof ImageData ? [result.data.buffer] : []
    );
  } catch (error) {
    reply({
      id,
      message: error instanceof Error ? error.message : "Unknown error",
      type: "error",
    });
  }
};

let queue: Promise<void> = Promise.resolve();

addEventListener("message", (event: MessageEvent<AiRequest>) => {
  const request = event.data;
  queue = queue.then(() => runJob(request));
});
