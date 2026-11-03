import type { ModelSpec, Precision } from "@/lib/ai/models";

// What this browser's GPU offers (navigator.gpu)
export interface GpuSupport {
  webgpu: boolean;
  // The "shader-f16" feature, which half-precision weights need
  f16: boolean;
}

// Where a model runs: WebGPU, or WebAssembly on one CPU thread (the site has
// no cross-origin isolation, so no threads)
export interface Backend {
  device: "webgpu" | "wasm";
  dtype: Precision;
}

// Every way this model can run here, best first: the GPU in half precision
// when both sides can, else in full precision, else the CPU. A model that's
// too big for a CPU never falls back to it.
export const backendChoices = (
  spec: Pick<ModelSpec, "bytes" | "gpuOnly">,
  { f16, webgpu }: GpuSupport
): Backend[] => {
  const choices: Backend[] = [];
  if (webgpu && f16 && spec.bytes.fp16) {
    choices.push({ device: "webgpu", dtype: "fp16" });
  }
  if (webgpu && spec.bytes.fp32) {
    choices.push({ device: "webgpu", dtype: "fp32" });
  }
  if (!spec.gpuOnly && spec.bytes.fp32) {
    choices.push({ device: "wasm", dtype: "fp32" });
  }
  return choices;
};

export const pickBackend = (
  spec: Pick<ModelSpec, "bytes" | "gpuOnly">,
  support: GpuSupport
): Backend | null => backendChoices(spec, support)[0] ?? null;

// Why a model can't run here, for when pickBackend finds no way
export const unsupportedReason = ({ webgpu }: GpuSupport): string =>
  webgpu
    ? "This GPU can't run the AI model (it lacks half-precision support)."
    : "This browser can't run the AI model (it needs WebGPU). Try a recent Chrome, Edge, or Safari.";
