import {
  AutoModel,
  AutoProcessor,
  RawImage,
  env,
} from "@huggingface/transformers";
import type {
  PreTrainedModel,
  Processor,
  ProgressInfo,
  Tensor,
} from "@huggingface/transformers";

import { applyMask, toRgb } from "@/lib/background-removal/compose";

// BEN2: MIT-licensed weights (fine for commercial thumbnails). At its fixed
// 1024px input it needs several GB of working memory, more than a serverless
// function gets, so it runs on the visitor's GPU via WebGPU. The browser
// caches the ~220 MB download after the first run.
const MODEL_ID = "onnx-community/BEN2-ONNX";

// Model files come from the Hugging Face hub, never this app's origin
env.allowLocalModels = false;

export interface CutoutRequest {
  id: number;
  image: Blob;
}

export type CutoutMessage =
  | { id: number; type: "progress"; progress: number }
  | { id: number; type: "done"; png: Blob; width: number; height: number }
  | { id: number; type: "error"; message: string };

interface ModelSession {
  inputNames: string[];
  outputNames: string[];
}

interface LoadedModel {
  model: PreTrainedModel;
  processor: Processor;
}

// The slice of the WebGPU API used here (TypeScript's DOM lib lacks it)
interface WebGpu {
  requestAdapter: () => Promise<{ features: ReadonlySet<string> } | null>;
}

const reply = (message: CutoutMessage) => postMessage(message);

// The model only ships in half precision, which needs the GPU's f16 support
const checkGpu = async () => {
  const { gpu } = navigator as Navigator & { gpu?: WebGpu };
  const adapter = await gpu?.requestAdapter();
  if (!adapter) {
    throw new Error(
      "This browser can't run the AI model (it needs WebGPU). Try a recent Chrome, Edge, or Safari."
    );
  }
  if (!adapter.features.has("shader-f16")) {
    throw new Error(
      "This GPU can't run the AI model (it lacks half-precision support)."
    );
  }
};

// Jobs run one at a time, so download progress belongs to the current one
let activeJob = 0;

const onProgress = (info: ProgressInfo) => {
  if (info.status === "progress_total") {
    reply({ id: activeJob, progress: info.progress, type: "progress" });
  }
};

let loading: Promise<LoadedModel> | undefined;

const loadModel = (): Promise<LoadedModel> => {
  if (!loading) {
    const attempt = (async () => {
      await checkGpu();
      const [model, processor] = await Promise.all([
        AutoModel.from_pretrained(MODEL_ID, {
          device: "webgpu",
          dtype: "fp16",
          progress_callback: onProgress,
          // ONNX Runtime's extended optimizations fuse the export's casts into
          // its LayerNorms, and the WebGPU shader for that fused form doesn't
          // compile (mixed f16/f32)
          session_options: { graphOptimizationLevel: "basic" },
        }),
        AutoProcessor.from_pretrained(MODEL_ID),
      ]);
      return { model, processor };
    })();
    // A failed download should be retried on the next request
    attempt.catch(() => {
      loading = undefined;
    });
    loading = attempt;
  }
  return loading;
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

const cutOut = async (image: Blob) => {
  const { model, processor } = await loadModel();
  const pixels = await readPixels(image);
  const { height, width } = pixels;
  const rgba = new Uint8Array(pixels.data.buffer);

  const { pixel_values: pixelValues } = await processor(
    new RawImage(toRgb(rgba), width, height, 3)
  );
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
  const prediction = outputs[output];
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

const runJob = async ({ id, image }: CutoutRequest) => {
  activeJob = id;
  try {
    reply({ id, type: "done", ...(await cutOut(image)) });
  } catch (error) {
    reply({
      id,
      message: error instanceof Error ? error.message : "Unknown error",
      type: "error",
    });
  }
};

let queue: Promise<void> = Promise.resolve();

addEventListener("message", (event: MessageEvent<CutoutRequest>) => {
  const request = event.data;
  // One image at a time: parallel runs only fight over the same GPU
  queue = queue.then(() => runJob(request));
});
