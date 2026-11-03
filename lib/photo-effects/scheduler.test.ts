import { describe, expect, it, vi } from "vitest";

import {
  MAX_RETRIES,
  createEffectsScheduler,
} from "@/lib/photo-effects/scheduler";

// Frames run when the test says so
const manualFrames = () => {
  const frames: (() => void)[] = [];
  return {
    next: () => {
      const due = frames.splice(0);
      for (const run of due) {
        run();
      }
    },
    pending: () => frames.length,
    request: (run: () => void) => {
      frames.push(run);
    },
  };
};

const PENDING = Symbol("pending");

const isSettled = async (promise: Promise<void>) => {
  const outcome = await Promise.race([
    promise.then(() => "settled" as const),
    // Settles after the promise would have, if it's already resolved
    Promise.resolve().then(() => PENDING),
  ]);
  return outcome !== PENDING;
};

describe("createEffectsScheduler", () => {
  it("runs each owner's latest work once on the next frame", () => {
    const frames = manualFrames();
    const scheduler = createEffectsScheduler(frames.request);
    const owner = {};
    const first = vi.fn(() => true);
    const latest = vi.fn(() => true);
    scheduler.request(owner, first);
    scheduler.request(owner, latest);
    scheduler.request({}, () => true);
    expect(frames.pending()).toBe(1);
    frames.next();
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledOnce();
    expect(frames.pending()).toBe(0);
  });

  it("settles once the work is done", async () => {
    const frames = manualFrames();
    const scheduler = createEffectsScheduler(frames.request);
    expect(await isSettled(scheduler.settled(1000))).toBe(true);
    scheduler.request({}, () => true);
    const settled = scheduler.settled(1000);
    expect(await isSettled(settled)).toBe(false);
    frames.next();
    expect(await isSettled(settled)).toBe(true);
  });

  it("retries work whose photo isn't ready, then gives up", async () => {
    const frames = manualFrames();
    const scheduler = createEffectsScheduler(frames.request);
    const work = vi.fn(() => false);
    scheduler.request({}, work);
    const settled = scheduler.settled(60_000);
    for (let frame = 0; frame < MAX_RETRIES - 1; frame += 1) {
      frames.next();
    }
    expect(await isSettled(settled)).toBe(false);
    frames.next();
    expect(work).toHaveBeenCalledTimes(MAX_RETRIES);
    expect(await isSettled(settled)).toBe(true);
  });

  it("waits for a held photo until it's requested or released", async () => {
    const frames = manualFrames();
    const scheduler = createEffectsScheduler(frames.request);
    const loading = {};
    scheduler.hold(loading);
    const settled = scheduler.settled(60_000);
    frames.next();
    expect(await isSettled(settled)).toBe(false);
    scheduler.request(loading, () => true);
    frames.next();
    expect(await isSettled(settled)).toBe(true);

    const failed = {};
    scheduler.hold(failed);
    const again = scheduler.settled(60_000);
    scheduler.release(failed);
    expect(await isSettled(again)).toBe(true);
  });

  it("stops waiting after the timeout, and survives failing work", async () => {
    vi.useFakeTimers();
    const frames = manualFrames();
    const scheduler = createEffectsScheduler(frames.request);
    scheduler.hold({});
    const settled = scheduler.settled(500);
    vi.advanceTimersByTime(500);
    expect(await isSettled(settled)).toBe(true);
    vi.useRealTimers();

    const broken = createEffectsScheduler(frames.request);
    broken.request({}, () => {
      throw new Error("lost context");
    });
    frames.next();
    expect(await isSettled(broken.settled(1000))).toBe(true);
  });
});
