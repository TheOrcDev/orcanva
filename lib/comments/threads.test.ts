import { describe, expect, it } from "vitest";

import type { DesignComment } from "@/lib/comments/schema";
import {
  filterThreads,
  groupThreads,
  isOnPage,
  threadCounts,
  threadIdOf,
} from "@/lib/comments/threads";

const comment = (
  id: string,
  createdAt: string,
  patch: Partial<DesignComment> = {}
): DesignComment => ({
  anchorHeight: null,
  anchorWidth: null,
  anchorX: null,
  anchorY: null,
  authorId: null,
  authorImage: null,
  authorName: "Jay",
  body: id,
  createdAt: `2026-11-03T${createdAt}:00.000Z`,
  editedAt: null,
  elementId: null,
  id,
  mentions: {},
  pageId: null,
  resolvedAt: null,
  threadId: null,
  x: 10,
  y: 20,
  ...patch,
});

const reply = (id: string, createdAt: string, threadId: string) =>
  comment(id, createdAt, { threadId, x: null, y: null });

const RESOLVED = { resolvedAt: "2026-11-03T12:00:00.000Z" };

describe("groupThreads", () => {
  it("puts replies under their thread, oldest first, newest thread first", () => {
    const threads = groupThreads([
      reply("r2", "10:05", "a"),
      comment("a", "10:00"),
      comment("b", "11:00"),
      reply("r1", "10:01", "a"),
    ]);
    expect(threads.map((thread) => thread.root.id)).toEqual(["b", "a"]);
    expect(threads[1]?.replies.map((item) => item.id)).toEqual(["r1", "r2"]);
    expect(threads[0]?.replies).toEqual([]);
  });

  it("leaves out replies whose thread isn't there", () => {
    expect(groupThreads([reply("r", "10:00", "gone")])).toEqual([]);
  });

  it("orders threads made at the same moment by id", () => {
    const threads = groupThreads([
      comment("a", "10:00"),
      comment("b", "10:00"),
    ]);
    expect(threads.map((thread) => thread.root.id)).toEqual(["b", "a"]);
  });
});

describe("filters and counts", () => {
  const threads = groupThreads([
    comment("open-1", "10:00"),
    comment("done", "10:01", RESOLVED),
    reply("r", "10:02", "done"),
    comment("open-2", "10:03"),
  ]);

  it("lists open or resolved threads", () => {
    expect(
      filterThreads(threads, "open").map((thread) => thread.root.id)
    ).toEqual(["open-2", "open-1"]);
    expect(
      filterThreads(threads, "resolved").map((thread) => thread.root.id)
    ).toEqual(["done"]);
  });

  it("counts threads, not replies", () => {
    expect(threadCounts(threads)).toEqual({ open: 2, resolved: 1 });
    expect(threadCounts([])).toEqual({ open: 0, resolved: 0 });
  });
});

describe("threadIdOf", () => {
  const comments = [comment("a", "10:00"), reply("r", "10:01", "a")];

  it("finds a reply's thread, and a thread's own", () => {
    expect(threadIdOf(comments, "r")).toBe("a");
    expect(threadIdOf(comments, "a")).toBe("a");
    expect(threadIdOf(comments, "nope")).toBeNull();
  });
});

describe("isOnPage", () => {
  it("puts threads without a page on the first page", () => {
    expect(isOnPage({ pageId: null }, "design", "design")).toBe(true);
    expect(isOnPage({ pageId: null }, "p2", "design")).toBe(false);
    expect(isOnPage({ pageId: "p2" }, "p2", "design")).toBe(true);
  });
});
