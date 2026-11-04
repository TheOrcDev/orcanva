// Runs render jobs one at a time, in the order they were asked for: the
// offscreen page renderer draws a single page at once. A job whose signal
// is aborted before its turn is skipped (its promise rejects with an
// AbortError), so a caller that moved on doesn't make the queue draw pages
// nobody will look at. A job that fails doesn't stop the ones after it.

export interface RenderQueue<Job, Result> {
  render: (job: Job, signal?: AbortSignal) => Promise<Result>;
  // Jobs waiting or running
  size: () => number;
}

const abortError = () => new DOMException("Render skipped", "AbortError");

export const createRenderQueue = <Job, Result>(
  run: (job: Job) => Promise<Result>
): RenderQueue<Job, Result> => {
  let tail: Promise<unknown> = Promise.resolve();
  let pending = 0;

  const render = (job: Job, signal?: AbortSignal): Promise<Result> => {
    pending += 1;
    const turn = tail.then(() => {
      if (signal?.aborted) {
        throw abortError();
      }
      return run(job);
    });
    const done = turn.finally(() => {
      pending -= 1;
    });
    // The next job waits for this one, however it ends
    tail = done.catch(() => null);
    return done;
  };

  return { render, size: () => pending };
};
