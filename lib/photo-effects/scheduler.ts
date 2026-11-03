import { registerRenderPreparer } from "@/lib/export/prepare";

// Recomputes photo effects at most once per frame, and keeps track of
// photos whose effects aren't drawn for their current settings yet, so
// exports and thumbnails can wait for them.

// Runs one owner's work: true when done, false to try again next frame
// (its photo node isn't ready)
export type EffectsWork = () => boolean;

export interface EffectsScheduler {
  // Does the owner's latest work on the next frame (earlier requests in
  // the same frame are dropped)
  request: (owner: object, work: EffectsWork) => void;
  // The owner can't be worked on yet (its photo is loading) but will be
  hold: (owner: object) => void;
  // Nothing left to do for the owner
  release: (owner: object) => void;
  // Resolves once nothing is queued or held, or after `timeoutMs`
  settled: (timeoutMs: number) => Promise<void>;
}

// A photo that never becomes ready stops being retried after this many
// frames (about two seconds)
export const MAX_RETRIES = 120;

export const createEffectsScheduler = (
  requestFrame: (run: () => void) => void
): EffectsScheduler => {
  const queued = new Map<object, EffectsWork>();
  const held = new Set<object>();
  const retries = new Map<object, number>();
  let framed = false;
  let waiters: (() => void)[] = [];

  const settle = () => {
    if (queued.size > 0 || held.size > 0) {
      return;
    }
    const done = waiters;
    waiters = [];
    for (const resolve of done) {
      resolve();
    }
  };

  const flush = () => {
    framed = false;
    const due = [...queued];
    queued.clear();
    for (const [owner, work] of due) {
      let finished = true;
      try {
        finished = work();
      } catch {
        // A failed recompute draws nothing; it mustn't hold up exports
      }
      const tries = (retries.get(owner) ?? 0) + 1;
      if (finished || tries >= MAX_RETRIES) {
        retries.delete(owner);
      } else {
        retries.set(owner, tries);
        queued.set(owner, work);
      }
    }
    if (queued.size > 0) {
      framed = true;
      requestFrame(flush);
    }
    settle();
  };

  return {
    hold: (owner) => {
      queued.delete(owner);
      retries.delete(owner);
      held.add(owner);
    },
    release: (owner) => {
      queued.delete(owner);
      retries.delete(owner);
      held.delete(owner);
      settle();
    },
    request: (owner, work) => {
      held.delete(owner);
      retries.delete(owner);
      queued.set(owner, work);
      if (!framed) {
        framed = true;
        requestFrame(flush);
      }
    },
    settled: (timeoutMs) => {
      if (queued.size === 0 && held.size === 0) {
        return Promise.resolve();
      }
      const { promise, resolve } = Promise.withResolvers<undefined>();
      const timer = setTimeout(() => resolve(undefined), timeoutMs);
      waiters.push(() => {
        clearTimeout(timer);
        resolve(undefined);
      });
      return promise;
    },
  };
};

// Longest an export waits for effects (a photo that never loads)
const PREPARE_TIMEOUT_MS = 10_000;

export const photoEffectsScheduler = createEffectsScheduler((run) => {
  requestAnimationFrame(run);
});

registerRenderPreparer(() => photoEffectsScheduler.settled(PREPARE_TIMEOUT_MS));
