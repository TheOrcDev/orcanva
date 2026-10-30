import type {
  CutoutMessage,
  CutoutRequest,
} from "@/lib/background-removal/worker";

export interface Cutout {
  png: Blob;
  width: number;
  height: number;
}

interface Job {
  resolve: (cutout: Cutout) => void;
  reject: (error: Error) => void;
  onProgress?: (percent: number) => void;
}

const jobs = new Map<number, Job>();
let nextId = 1;
let worker: Worker | undefined;

const handleMessage = ({ data }: MessageEvent<CutoutMessage>) => {
  const job = jobs.get(data.id);
  if (!job) {
    return;
  }
  if (data.type === "progress") {
    job.onProgress?.(data.progress);
    return;
  }
  jobs.delete(data.id);
  if (data.type === "error") {
    job.reject(new Error(data.message));
    return;
  }
  job.resolve({ height: data.height, png: data.png, width: data.width });
};

// The worker itself died (failed to load, out of memory): fail every job
// and start a fresh one next time
const handleCrash = () => {
  for (const job of jobs.values()) {
    job.reject(new Error("The background remover stopped unexpectedly"));
  }
  jobs.clear();
  worker?.terminate();
  worker = undefined;
};

const getWorker = (): Worker => {
  if (!worker) {
    worker = new Worker(new URL("worker.ts", import.meta.url), {
      type: "module",
    });
    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleCrash);
  }
  return worker;
};

// Cuts the subject out of an image in a Web Worker. The model loads once per
// tab and stays warm for later images; `onProgress` reports its download.
export const cutOutBackground = (
  image: Blob,
  onProgress?: (percent: number) => void
): Promise<Cutout> => {
  const { promise, reject, resolve } = Promise.withResolvers<Cutout>();
  const id = nextId;
  nextId += 1;
  jobs.set(id, { onProgress, reject, resolve });
  // Workers take no target origin; the rule assumes window.postMessage
  // oxlint-disable-next-line unicorn/require-post-message-target-origin
  getWorker().postMessage({ id, image } satisfies CutoutRequest);
  return promise;
};
