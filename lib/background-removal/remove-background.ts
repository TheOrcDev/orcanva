import "server-only";
import path from "node:path";

import {
  AutoModel,
  AutoProcessor,
  RawImage,
  env,
} from "@huggingface/transformers";
import type {
  PreTrainedModel,
  Processor,
  Tensor,
} from "@huggingface/transformers";
import sharp from "sharp";

import { applyMask, toRgb } from "@/lib/background-removal/compose";

// BiRefNet-lite: MIT-licensed weights (fine for commercial thumbnails),
// runs on the CPU via onnxruntime-node at full 1024px quality. ~224 MB,
// downloaded once on first use into .cache/models.
export const BACKGROUND_MODEL_ID = "onnx-community/BiRefNet_lite-ONNX";

env.cacheDir = path.join(process.cwd(), ".cache", "models");

interface LoadedModel {
  model: PreTrainedModel;
  processor: Processor;
}

// Kept on globalThis so dev hot reloads don't load the model again
const cache = globalThis as typeof globalThis & {
  orcanvaBackgroundModel?: Promise<LoadedModel>;
  orcanvaBackgroundQueue?: Promise<unknown>;
};

const loadModel = (): Promise<LoadedModel> => {
  if (!cache.orcanvaBackgroundModel) {
    const loading = Promise.all([
      AutoModel.from_pretrained(BACKGROUND_MODEL_ID, { dtype: "fp32" }),
      AutoProcessor.from_pretrained(BACKGROUND_MODEL_ID),
    ]).then(([model, processor]) => ({ model, processor }));
    // A failed download should be retried on the next request
    loading.catch(() => {
      cache.orcanvaBackgroundModel = undefined;
    });
    cache.orcanvaBackgroundModel = loading;
  }
  return cache.orcanvaBackgroundModel;
};

export interface CutoutResult {
  png: Buffer;
  width: number;
  height: number;
}

const cutOut = async (input: Uint8Array): Promise<CutoutResult> => {
  const { model, processor } = await loadModel();

  // One decode (EXIF-rotated) feeds both the model and the final alpha
  const { data, info } = await sharp(input)
    .rotate()
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const rgba = new Uint8Array(data);
  const image = new RawImage(toRgb(rgba), info.width, info.height, 3);

  const { pixel_values: pixelValues } = await processor(image);
  const { output_image: logits } = (await model({
    input_image: pixelValues,
  })) as { output_image: Tensor };
  const mask = await RawImage.fromTensor(
    logits.squeeze(0).sigmoid().mul(255).to("uint8")
  ).resize(info.width, info.height);

  const png = await sharp(applyMask(rgba, mask.data), {
    raw: { channels: 4, height: info.height, width: info.width },
  })
    .png()
    .toBuffer();
  return { height: info.height, png, width: info.width };
};

// One image at a time: inference saturates the CPU, so parallel jobs only
// slow each other down and multiply memory use
export const removeBackground = (input: Uint8Array): Promise<CutoutResult> => {
  const previous = cache.orcanvaBackgroundQueue ?? Promise.resolve();
  const job = previous.catch(() => null).then(() => cutOut(input));
  cache.orcanvaBackgroundQueue = job;
  return job;
};
