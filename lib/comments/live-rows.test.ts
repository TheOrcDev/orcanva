import { describe, expect, it } from "vitest";

import { commentFromRow } from "@/lib/comments/live-rows";
import type { LiveCommentRow } from "@/lib/comments/live-rows";

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
