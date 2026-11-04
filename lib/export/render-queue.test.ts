import { describe, expect, it } from "vitest";

import { createRenderQueue } from "@/lib/export/render-queue";

const later = () => {
  const { promise, resolve } = Promise.withResolvers<undefined>();
  return { promise, resolve: () => resolve(undefined) };
};

describe("render queue", () => {
  it("runs one job at a time, in order", async () => {
    const started: string[] = [];
    const gates = new Map([
      ["a", later()],
      ["b", later()],
    ]);
    const queue = createRenderQueue(async (job: string) => {
      started.push(job);
      await gates.get(job)?.promise;
      return job.toUpperCase();
    });

    const a = queue.render("a");
    const b = queue.render("b");
    await Promise.resolve();
    expect(started).toEqual(["a"]);
    expect(queue.size()).toBe(2);

    gates.get("a")?.resolve();
    expect(await a).toBe("A");
    await Promise.resolve();
    expect(started).toEqual(["a", "b"]);
    gates.get("b")?.resolve();
    expect(await b).toBe("B");
    expect(queue.size()).toBe(0);
  });

  it("goes on after a job fails", async () => {
    const queue = createRenderQueue((job: number) =>
      job === 1
        ? Promise.reject(new Error("no canvas"))
        : Promise.resolve(job * 2)
    );
    const failed = queue.render(1);
    const next = queue.render(2);
    await expect(failed).rejects.toThrow("no canvas");
    expect(await next).toBe(4);
  });

  it("skips a job abandoned before its turn", async () => {
    const ran: number[] = [];
    const gate = later();
    const queue = createRenderQueue(async (job: number) => {
      ran.push(job);
      await gate.promise;
      return job;
    });
    const controller = new AbortController();
    const first = queue.render(1);
    const skipped = queue.render(2, controller.signal);
    const third = queue.render(3);
    controller.abort();
    gate.resolve();

    expect(await first).toBe(1);
    await expect(skipped).rejects.toMatchObject({ name: "AbortError" });
    expect(await third).toBe(3);
    expect(ran).toEqual([1, 3]);
  });
});
