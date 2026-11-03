import type {
  AiMessage,
  AiProgress,
  AiRequest,
  AiResults,
  AiTask,
} from "@/lib/ai/worker";

export type { AiProgress, AiResults, AiTask } from "@/lib/ai/worker";

interface Job {
  resolve: (result: AiResults[AiTask["kind"]]) => void;
  reject: (error: Error) => void;
  onProgress?: (progress: AiProgress) => void;
}

const jobs = new Map<number, Job>();
let nextId = 1;
let worker: Worker | undefined;

const handleMessage = ({ data }: MessageEvent<AiMessage>) => {
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
  job.resolve(data.result);
};

// The worker itself died (failed to load, out of memory): fail every job
// and start a fresh one next time
const handleCrash = () => {
  for (const job of jobs.values()) {
    job.reject(new Error("The AI model stopped unexpectedly"));
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

// Runs an AI task in the shared worker (lib/ai/worker.ts), which loads the
// model once per tab and keeps it warm. `onProgress` reports the model's
// download, and the work itself where the task can tell. `transfer` hands
// buffers over instead of copying them.
export const runAiTask = <Task extends AiTask>(
  task: Task,
  onProgress?: (progress: AiProgress) => void,
  transfer: Transferable[] = []
): Promise<AiResults[Task["kind"]]> => {
  const { promise, reject, resolve } =
    Promise.withResolvers<AiResults[Task["kind"]]>();
  const id = nextId;
  nextId += 1;
  jobs.set(id, {
    onProgress,
    reject,
    // The worker answers each kind of task with its own kind of result
    resolve: resolve as (result: AiResults[AiTask["kind"]]) => void,
  });
  // Workers take no target origin; the rule assumes window.postMessage
  // oxlint-disable-next-line unicorn/require-post-message-target-origin
  getWorker().postMessage({ id, task } satisfies AiRequest, transfer);
  return promise;
};
