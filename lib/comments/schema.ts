import { z } from "zod";

import { MAX_COMMENT_LENGTH } from "@/lib/comments/limits";
import { pageIdSchema } from "@/lib/document/schema";

// A comment as the editor holds it: a row of design_comments, timestamps as
// ISO strings. A thread is its root (threadId null), which holds the pin.
export interface DesignComment {
  id: string;
  threadId: string | null;
  authorId: string | null;
  authorName: string;
  authorImage: string | null;
  // Plain text, mentions as <@user id> tokens (see ./body)
  body: string;
  // The mentioned people's names, by user id
  mentions: Readonly<Record<string, string>>;
  // null is the first page
  pageId: string | null;
  // Roots only: where the pin is on the page, and the element it's on
  x: number | null;
  y: number | null;
  elementId: string | null;
  anchorX: number | null;
  anchorY: number | null;
  anchorWidth: number | null;
  anchorHeight: number | null;
  resolvedAt: string | null;
  createdAt: string;
  editedAt: string | null;
}

// Someone a comment can mention: the design's owner or a person it's shared
// with. Never their email.
export interface MentionPerson {
  id: string;
  name: string;
  image: string | null;
}

const coordinate = z.number().finite().min(-100_000).max(100_000);
const size = z.number().finite().positive().max(100_000);

// Where a new thread's pin goes on its element (see ./anchor)
export const commentAnchorSchema = z.object({
  anchorHeight: size.nullable(),
  anchorWidth: size,
  anchorX: coordinate,
  anchorY: coordinate,
  elementId: z.string().min(1).max(64),
});

export type CommentAnchor = z.infer<typeof commentAnchorSchema>;

export const commentPinSchema = z.object({
  anchor: commentAnchorSchema.nullable(),
  pageId: pageIdSchema.nullable(),
  x: coordinate,
  y: coordinate,
});

// A new thread's pin, before it's posted
export type CommentPin = z.infer<typeof commentPinSchema>;

// Raw text; it's normalised and measured by checkBody (./body)
const rawBody = z.string().max(MAX_COMMENT_LENGTH * 4);

// POST /api/designs/[id]/comments: a new thread with its pin, or a reply
export const newCommentSchema = z.union([
  z.object({ body: rawBody, pin: commentPinSchema }),
  z.object({ body: rawBody, threadId: z.uuid() }),
]);

export type NewComment = z.infer<typeof newCommentSchema>;

// PATCH …/comments/[commentId]: new text (its author), or resolving and
// reopening a thread
export const commentPatchSchema = z.union([
  z.object({ body: rawBody }),
  z.object({ resolved: z.boolean() }),
]);

export type CommentPatch = z.infer<typeof commentPatchSchema>;
