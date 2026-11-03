import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  RENEWAL_REUSE_MS,
  RENEWAL_WINDOW_MS,
  createRenewalBatcher,
} from "@/lib/collab/renewals";

interface Queries {
  page: string;
  elements: string;
  presence: string;
  comments: string;
}

const NAMES = ["page", "elements", "presence", "comments"] as const;

// Each request seals every query as "<name>#<request number>"
const setup = (fail = false) => {
  let requests = 0;
  const fetchBatch = vi.fn(async (names: readonly (keyof Queries)[]) => {
    requests += 1;
    const request = requests;
    await Promise.resolve();
    if (fail) {
      throw new Error("offline");
    }
    return Object.fromEntries(
      names.map((name) => [name, `${name}#${request}`])
    ) as Partial<Queries>;
  });
  const batcher = createRenewalBatcher<Queries>({ fetchBatch, names: NAMES });
  return { batcher, fetchBatch };
};

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createRenewalBatcher", () => {
  it("sends one request for queries renewing together", async () => {
    const { batcher, fetchBatch } = setup();
    const renewed = Promise.all(NAMES.map((name) => batcher.renew(name)));
    await vi.advanceTimersByTimeAsync(RENEWAL_WINDOW_MS);
    expect(await renewed).toEqual([
      "page#1",
      "elements#1",
      "presence#1",
      "comments#1",
    ]);
    expect(fetchBatch).toHaveBeenCalledTimes(1);
    expect(fetchBatch).toHaveBeenCalledWith(NAMES);
  });

  it("asks for every query even when one renews alone, and keeps the rest", async () => {
    const { batcher, fetchBatch } = setup();
    const page = batcher.renew("page");
    await vi.advanceTimersByTimeAsync(RENEWAL_WINDOW_MS);
    expect(await page).toBe("page#1");

    // The others come a few seconds later (a retry, say): no new request
    await vi.advanceTimersByTimeAsync(3000);
    const elements = batcher.renew("elements");
    const comments = batcher.renew("comments");
    expect(await elements).toBe("elements#1");
    expect(await comments).toBe("comments#1");
    expect(fetchBatch).toHaveBeenCalledTimes(1);
  });

  it("hands out a kept query once", async () => {
    const { batcher, fetchBatch } = setup();
    const page = batcher.renew("page");
    await vi.advanceTimersByTimeAsync(RENEWAL_WINDOW_MS);
    await page;
    expect(await batcher.renew("elements")).toBe("elements#1");

    const again = batcher.renew("elements");
    await vi.advanceTimersByTimeAsync(RENEWAL_WINDOW_MS);
    expect(await again).toBe("elements#2");
    expect(fetchBatch).toHaveBeenCalledTimes(2);
  });

  it("doesn't reuse a kept query that's getting old", async () => {
    const { batcher, fetchBatch } = setup();
    const page = batcher.renew("page");
    await vi.advanceTimersByTimeAsync(RENEWAL_WINDOW_MS);
    await page;

    await vi.advanceTimersByTimeAsync(RENEWAL_REUSE_MS);
    const presence = batcher.renew("presence");
    await vi.advanceTimersByTimeAsync(RENEWAL_WINDOW_MS);
    expect(await presence).toBe("presence#2");
    expect(fetchBatch).toHaveBeenCalledTimes(2);
  });

  it("lets a renewal join the request under way", async () => {
    const gate = Promise.withResolvers<undefined>();
    const fetchBatch = vi.fn(
      async (names: readonly (keyof Queries)[]): Promise<Partial<Queries>> => {
        await gate.promise;
        return Object.fromEntries(names.map((name) => [name, `${name}!`]));
      }
    );
    const batcher = createRenewalBatcher<Queries>({ fetchBatch, names: NAMES });
    const page = batcher.renew("page");
    await vi.advanceTimersByTimeAsync(RENEWAL_WINDOW_MS);
    expect(fetchBatch).toHaveBeenCalledTimes(1);

    const presence = batcher.renew("presence");
    await vi.advanceTimersByTimeAsync(RENEWAL_WINDOW_MS);
    gate.resolve(undefined);
    expect(await page).toBe("page!");
    expect(await presence).toBe("presence!");
    expect(fetchBatch).toHaveBeenCalledTimes(1);
  });

  it("fails every renewal waiting on a failed request, then tries again", async () => {
    const { batcher, fetchBatch } = setup(true);
    const page = batcher.renew("page");
    const elements = batcher.renew("elements");
    const settled = Promise.allSettled([page, elements]);
    await vi.advanceTimersByTimeAsync(RENEWAL_WINDOW_MS);
    const results = await settled;
    expect(results.map((result) => result.status)).toEqual([
      "rejected",
      "rejected",
    ]);

    const retry = batcher.renew("page");
    const retried = expect(retry).rejects.toThrow("offline");
    await vi.advanceTimersByTimeAsync(RENEWAL_WINDOW_MS);
    await retried;
    expect(fetchBatch).toHaveBeenCalledTimes(2);
  });

  it("fails a renewal the server sent nothing for", async () => {
    const fetchBatch = vi.fn(async () => {
      await Promise.resolve();
      return { page: "page#1" } as Partial<Queries>;
    });
    const batcher = createRenewalBatcher<Queries>({ fetchBatch, names: NAMES });
    const page = batcher.renew("page");
    const comments = expect(batcher.renew("comments")).rejects.toThrow(
      "No sealed query for comments"
    );
    await vi.advanceTimersByTimeAsync(RENEWAL_WINDOW_MS);
    expect(await page).toBe("page#1");
    await comments;
  });
});
