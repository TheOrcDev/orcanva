import { describe, expect, it } from "vitest";

import { backendChoices, pickBackend } from "@/lib/ai/backend";
import { MODELS } from "@/lib/ai/models";

const GPU_F16 = { f16: true, webgpu: true };
const GPU = { f16: false, webgpu: true };
const NO_GPU = { f16: false, webgpu: false };

describe("pickBackend", () => {
  it("runs BEN2 only on a GPU with half precision", () => {
    expect(pickBackend(MODELS.ben2, GPU_F16)).toEqual({
      device: "webgpu",
      dtype: "fp16",
    });
    expect(pickBackend(MODELS.ben2, GPU)).toBeNull();
    expect(pickBackend(MODELS.ben2, NO_GPU)).toBeNull();
  });

  it("runs the upscaler in half precision when it can, else full", () => {
    expect(pickBackend(MODELS.realesrgan, GPU_F16)).toEqual({
      device: "webgpu",
      dtype: "fp16",
    });
    expect(pickBackend(MODELS.realesrgan, GPU)).toEqual({
      device: "webgpu",
      dtype: "fp32",
    });
  });

  it("falls back to the CPU without WebGPU", () => {
    for (const spec of [MODELS.migan, MODELS.lama, MODELS.realesrgan]) {
      expect(pickBackend(spec, NO_GPU)).toEqual({
        device: "wasm",
        dtype: "fp32",
      });
    }
  });
});

describe("backendChoices", () => {
  it("lists the CPU after the GPU, for when WebGPU fails", () => {
    expect(backendChoices(MODELS.migan, GPU_F16)).toEqual([
      { device: "webgpu", dtype: "fp32" },
      { device: "wasm", dtype: "fp32" },
    ]);
    expect(backendChoices(MODELS.realesrgan, GPU_F16)).toEqual([
      { device: "webgpu", dtype: "fp16" },
      { device: "webgpu", dtype: "fp32" },
      { device: "wasm", dtype: "fp32" },
    ]);
  });
});

describe("MODELS", () => {
  it("pins every model but BEN2 to a commit", () => {
    for (const [id, spec] of Object.entries(MODELS)) {
      if (id !== "ben2") {
        expect(spec.revision, id).toMatch(/^[0-9a-f]{40}$/u);
      }
    }
  });
});
