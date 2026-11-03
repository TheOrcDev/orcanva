import { describe, expect, it } from "vitest";

import {
  COMMENT_ECHO_MS,
  commentFromRow,
  commentsFromRows,
  withEchoes,
} from "@/lib/comments/live-rows";
import type { CommentEcho, LiveCommentRow } from "@/lib/comments/live-rows";
import type { DesignComment } from "@/lib/comments/schema";

const ROOT: LiveCommentRow = {
  anchor_height: null,
  anchor_width: 200,
  anchor_x: 12.5,
  anchor_y: 4,
  author_id: "8f1c0e1e-6c5d-4c71-9f7b-0b5a3a1d2e01",
  author_image: "https://lh3.googleusercontent.com/a/photo",
  author_name: "Olga Owner",
  body: "Make the title bigger",
  created_at: new Date("2026-11-03T10:00:00Z"),
  edited_at: null,
  element_id: "title",
  id: "c0ffee00-0000-4000-8000-000000000001",
  mentions: {},
  page_id: null,
  resolved_at: null,
  thread_id: null,
  x: 112.5,
  y: 54,
};

describe("commentFromRow", () => {
  it("reads a row, with its times as ISO strings", () => {
    expect(commentFromRow(ROOT)).toMatchObject({
      anchorWidth: 200,
      authorName: "Olga Owner",
      createdAt: "2026-11-03T10:00:00.000Z",
      elementId: "title",
      threadId: null,
      x: 112.5,
    });
  });

  it("reads the text form raw SQL returns", () => {
    expect(
      commentFromRow({
        ...ROOT,
        created_at: "2026-11-03T10:00:00.123456+00:00",
        resolved_at: "2026-11-03 11:00:00+00",
        x: "112.5",
      })
    ).toMatchObject({
      createdAt: "2026-11-03T10:00:00.123Z",
      resolvedAt: "2026-11-03T11:00:00.000Z",
      x: 112.5,
    });
  });

  it("drops avatars from anywhere else, and unreadable mentions", () => {
    expect(
      commentFromRow({
        ...ROOT,
        author_image: "http://example.com/tracker.png",
        mentions: ["nope"],
      })
    ).toMatchObject({ authorImage: null, mentions: {} });
  });

  it("refuses rows that aren't comments", () => {
    expect(commentFromRow({ ...ROOT, created_at: "yesterday" })).toBeNull();
    expect(commentFromRow({ ...ROOT, body: 3 })).toBeNull();
    expect(commentFromRow(null)).toBeNull();
  });
});

const row = (id: string, body = "Hi"): LiveCommentRow => ({
  ...ROOT,
  body,
  id,
});

const read = (id: string, body = "Hi"): DesignComment => {
  const comment = commentFromRow(row(id, body));
  if (!comment) {
    throw new Error("unreadable");
  }
  return comment;
};

describe("commentsFromRows", () => {
  it("keeps the objects of rows that didn't change", () => {
    const first = commentsFromRows([row("a"), row("b")], []);
    const second = commentsFromRows([row("a"), row("b", "Edited")], first);
    expect(second[0]).toBe(first[0]);
    expect(second[1]).not.toBe(first[1]);
    expect(second[1]?.body).toBe("Edited");
  });

  it("keeps the whole list when nothing changed", () => {
    const first = commentsFromRows([row("a"), row("b")], []);
    expect(commentsFromRows([row("a"), row("b")], first)).toBe(first);
  });

  it("leaves out rows it can't read, and ones that are gone", () => {
    const first = commentsFromRows([row("a"), row("b")], []);
    expect(
      commentsFromRows([row("a"), { ...row("c"), body: null }], first).map(
        (comment) => comment.id
      )
    ).toEqual(["a"]);
  });
});

describe("withEchoes", () => {
  const NOW = 1_000_000;
  const echoes = (entries: [string, DesignComment | null][], at = NOW) =>
    new Map<string, CommentEcho>(
      entries.map(([id, comment]) => [id, { at, comment }])
    );

  it("keeps a posted comment the live result doesn't have yet", () => {
    const posted = read("new");
    const result = withEchoes([read("a")], echoes([["new", posted]]), NOW);
    expect(result.comments.map((comment) => comment.id)).toEqual(["a", "new"]);
    expect(result.echoes.has("new")).toBe(true);
  });

  it("lets go once the live result shows the write", () => {
    const live = [read("a"), read("new")];
    const result = withEchoes(live, echoes([["new", read("new")]]), NOW);
    expect(result.comments).toBe(live);
    expect(result.echoes.size).toBe(0);
  });

  it("shows an edit over an older live row, and hides a deleted one", () => {
    const result = withEchoes(
      [read("a"), read("b")],
      echoes([
        ["a", read("a", "Edited")],
        ["b", null],
      ]),
      NOW
    );
    expect(result.comments.map((comment) => comment.body)).toEqual(["Edited"]);
  });

  it("gives up on an echo after a while, and the live result wins", () => {
    const live = [read("a")];
    const result = withEchoes(
      live,
      echoes([["a", read("a", "Edited")]], NOW - COMMENT_ECHO_MS),
      NOW
    );
    expect(result.comments).toBe(live);
    expect(result.echoes.size).toBe(0);
  });
});
