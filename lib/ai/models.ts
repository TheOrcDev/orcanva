// The AI models Orcanva runs in the browser, each loaded straight from its
// original Hugging Face repo by Transformers.js. Files are pinned to a commit
// in the URL, so what visitors download can't change under us; the browser
// keeps them in Cache Storage ("transformers-cache"), keyed by that URL.
// Licences were checked against each repo's model card and LICENSE file.

export type ModelId = "ben2" | "lama" | "migan" | "realesrgan";

// Weights in half or full precision. Transformers.js picks the file by it:
// "<file>_fp16.onnx" or "<file>.onnx".
export type Precision = "fp16" | "fp32";

export interface ModelSpec {
  name: string;
  repo: string;
  // A commit of the repo, or "main" (see BEN2)
  revision: string;
  // Where the ONNX file sits in the repo, and its name without the
  // precision suffix and ".onnx"
  subfolder: string;
  file: string;
  // Download size in bytes of each precision the repo has, best first
  bytes: Partial<Record<Precision, number>>;
  // Too big for a CPU to run in reasonable time
  gpuOnly: boolean;
  // Big enough that only one such model stays loaded at a time
  heavy: boolean;
  licence: { name: string; url: string };
  // The data the weights were trained on, when its terms say something the
  // weights' licence doesn't
  trainedOn?: string;
  // Repos without a config.json get this one, so nothing asks for it
  config?: Record<string, unknown>;
  // ONNX Runtime session options the model needs
  sessionOptions?: Record<string, unknown>;
}

// For repos that are just an ONNX file: Transformers.js runs a model of an
// unknown type as one session over "<subfolder>/<file>.onnx"
const BARE_ONNX = { model_type: "custom" };

export const MODELS: Readonly<Record<ModelId, ModelSpec>> = {
  // Background removal. Left on "main", as it shipped: pinning it would change
  // its cache key and make every returning visitor download 220 MB again.
  // Main was c552aa82688edce09f0ac9d2e31ad53d9d629010 on 2026-11-03.
  ben2: {
    bytes: { fp16: 219_121_675 },
    file: "model",
    gpuOnly: true,
    heavy: true,
    licence: {
      name: "MIT",
      url: "https://huggingface.co/onnx-community/BEN2-ONNX",
    },
    name: "BEN2",
    repo: "onnx-community/BEN2-ONNX",
    revision: "main",
    // ONNX Runtime's extended optimizations fuse the export's casts into its
    // LayerNorms, and the WebGPU shader for that fused form doesn't compile
    // (mixed f16/f32)
    sessionOptions: { graphOptimizationLevel: "basic" },
    subfolder: "onnx",
  },
  // The eraser's optional second model: big-lama (Apache-2.0, from
  // advimman/lama via Carve/LaMa-ONNX) with its weights stored as int4/int8
  // and the Fourier units rewritten to rank 4 or less so every WebGPU runs
  // them. Fixed 512×512 input.
  lama: {
    bytes: { fp32: 36_931_151 },
    config: BARE_ONNX,
    file: "lama_int4_int8_r4",
    gpuOnly: false,
    heavy: true,
    licence: {
      name: "Apache-2.0",
      url: "https://huggingface.co/othytenk/lama-int4-int8/blob/b52ebb642126086fe3da1524a3b1d7629ae4c6a9/LICENSE",
    },
    name: "LaMa",
    repo: "othytenk/lama-int4-int8",
    revision: "b52ebb642126086fe3da1524a3b1d7629ae4c6a9",
    // Folds the int4/int8 weights back to fp32 when the session loads
    sessionOptions: { extra: { session: { disable_quant_qdq: "1" } } },
    subfolder: "",
    trainedOn: "Places2",
  },
  // The magic eraser: Picsart's MI-GAN 512 (Places2) as their ONNX pipeline,
  // which takes a photo of any size with a mask, crops around the mask,
  // fills it at 512px and blends the result back
  migan: {
    bytes: { fp32: 28_079_181 },
    config: BARE_ONNX,
    file: "migan_pipeline_v2",
    gpuOnly: false,
    heavy: false,
    licence: {
      name: "MIT",
      url: "https://huggingface.co/andraniksargsyan/migan/blob/406830d0fa60666da0071c342ad2fbc8f30c5c64/LICENSE",
    },
    name: "MI-GAN",
    repo: "andraniksargsyan/migan",
    revision: "406830d0fa60666da0071c342ad2fbc8f30c5c64",
    subfolder: "",
    trainedOn: "Places2",
  },
  // The upscaler: Real-ESRGAN general v3 (SRVGGNetCompact, 4×), the official
  // weights from xinntao/Real-ESRGAN's v0.2.5.0 release exported to ONNX
  // unchanged. Any input size; float32 in and out in both files.
  realesrgan: {
    bytes: { fp16: 2_444_980, fp32: 4_866_420 },
    config: BARE_ONNX,
    file: "model",
    gpuOnly: false,
    heavy: false,
    licence: {
      name: "BSD-3-Clause",
      url: "https://huggingface.co/vlad-grig/realesr-general-x4v3-onnx/blob/0e95d93e454cf6b5de9bdf5a1c9e7ec340d38231/LICENSE",
    },
    name: "Real-ESRGAN general v3",
    repo: "vlad-grig/realesr-general-x4v3-onnx",
    revision: "0e95d93e454cf6b5de9bdf5a1c9e7ec340d38231",
    subfolder: "onnx",
  },
};

// "28 MB", for telling people what a first run downloads
export const downloadSize = (bytes: number): string =>
  `${Math.max(1, Math.round(bytes / 1_000_000))} MB`;
