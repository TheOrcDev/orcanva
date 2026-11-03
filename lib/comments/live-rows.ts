import { z } from "zod";

import { isDeepEqual } from "@/lib/collab/equal";
import type { DesignComment } from "@/lib/comments/schema";
import { isStoredAvatarUrl } from "@/lib/storage/keys";

// The columns of design_comments that the editor reads, in the order the
// live query and the routes select them
export const COMMENT_COLUMNS =
  "id, thread_id, author_id, author_name, author_image, body, mentions, page_id, x, y, element_id, anchor_x, anchor_y, anchor_width, anchor_height, resolved_at, created_at, edited_at";

// A row of design_comments as the live query and raw SQL deliver it:
// timestamps as Dates or strings, jsonb parsed but unchecked
export interface LiveCommentRow {
  id: string;
  thread_id: string | null;
  author_id: string | null;
  author_name: string;
  author_image: string | null;
  body: string;
  mentions: unknown;
  page_id: string | null;
  x: number | null;
  y: number | null;
  element_id: string | null;
  anchor_x: number | null;
  anchor_y: number | null;
  anchor_width: number | null;
  anchor_height: number | null;
  resolved_at: Date | string | null;
  created_at: Date | string;
  edited_at: Date | string | null;
}

// As an ISO string in UTC, so times compare as text
const timestamp = z
  .union([z.date(), z.string()])
  .transform((value, context) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      context.addIssue({ code: "custom", message: "Invalid timestamp" });
      return z.NEVER;
    }
    return date.toISOString();
  });

const number = z
  .union([z.number(), z.string()])
  .transform(Number)
  .pipe(z.number().finite())
  .nullable();

// Only https avatars from the auth provider, or ones uploaded here (the
// server copies them from the account, as for presence)
const avatar = z
  .string()
  .nullable()
  .transform((image) =>
    image !== null && (image.startsWith("https://") || isStoredAvatarUrl(image))
      ? image
      : null
  );

const commentRowSchema = z.object({
  anchor_height: number,
  anchor_width: number,
  anchor_x: number,
  anchor_y: number,
  author_id: z.string().nullable(),
  author_image: avatar,
  author_name: z.string(),
  body: z.string(),
  created_at: timestamp,
  edited_at: timestamp.nullable(),
  element_id: z.string().nullable(),
  id: z.string(),
  mentions: z.record(z.string(), z.string()).catch({}),
  page_id: z.string().nullable(),
  resolved_at: timestamp.nullable(),
  thread_id: z.string().nullable(),
  x: number,
  y: number,
});

// A comment from its row; null when the row doesn't read as one
export const commentFromRow = (row: unknown): DesignComment | null => {
  const parsed = commentRowSchema.safeParse(row);
  if (!parsed.success) {
    return null;
  }
  const { data } = parsed;
  return {
    anchorHeight: data.anchor_height,
    anchorWidth: data.anchor_width,
    anchorX: data.anchor_x,
    anchorY: data.anchor_y,
    authorId: data.author_id,
    authorImage: data.author_image,
    authorName: data.author_name,
    body: data.body,
    createdAt: data.created_at,
    editedAt: data.edited_at,
    elementId: data.element_id,
    id: data.id,
    mentions: data.mentions,
    pageId: data.page_id,
    resolvedAt: data.resolved_at,
    threadId: data.thread_id,
    x: data.x,
    y: data.y,
  };
};

// Comments from a live result. A row that didn't change keeps its previous
// object, and an unchanged result the previous array, so nothing redraws
// for nothing; rows that don't read as comments are left out.
export const commentsFromRows = (
  rows: readonly unknown[],
  previous: readonly DesignComment[]
): readonly DesignComment[] => {
  const known = new Map(previous.map((comment) => [comment.id, comment]));
  const comments: DesignComment[] = [];
  for (const row of rows) {
    const comment = commentFromRow(row);
    if (comment) {
      const before = known.get(comment.id);
      comments.push(before && isDeepEqual(before, comment) ? before : comment);
    }
  }
  const unchanged =
    comments.length === previous.length &&
    comments.every((comment, index) => comment === previous[index]);
  return unchanged ? previous : comments;
};

// A comment this window posted, changed (`comment`) or deleted (null) at
// `at`, kept on top of live results until one shows it: a result the live
// query worked out before the write would otherwise hide it for a moment
export interface CommentEcho {
  comment: DesignComment | null;
  at: number;
}

// After this long a live result wins whatever it says
export const COMMENT_ECHO_MS = 10_000;

export const withEchoes = (
  live: readonly DesignComment[],
  echoes: ReadonlyMap<string, CommentEcho>,
  now: number
): {
  comments: readonly DesignComment[];
  echoes: ReadonlyMap<string, CommentEcho>;
} => {
  const waiting = new Map<string, CommentEcho>();
  for (const [id, echo] of echoes) {
    const shown = live.find((comment) => comment.id === id);
    const seen =
      echo.comment === null
        ? shown === undefined
        : shown !== undefined && isDeepEqual(shown, echo.comment);
    if (!seen && now - echo.at < COMMENT_ECHO_MS) {
      waiting.set(id, echo);
    }
  }
  if (waiting.size === 0) {
    return { comments: live, echoes: echoes.size === 0 ? echoes : waiting };
  }
  const comments = live.flatMap((comment) => {
    const echo = waiting.get(comment.id);
    if (!echo) {
      return [comment];
    }
    return echo.comment ? [echo.comment] : [];
  });
  for (const [id, echo] of waiting) {
    if (echo.comment && !live.some((comment) => comment.id === id)) {
      comments.push(echo.comment);
    }
  }
  return { comments, echoes: waiting };
};
