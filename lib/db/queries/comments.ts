import "server-only";
import { sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import type { Viewer } from "@/lib/auth/server";
import {
  COMMENT_RATE_LIMIT,
  COMMENT_RATE_WINDOW_MINUTES,
  MAX_COMMENTS_PER_DESIGN,
} from "@/lib/comments/limits";
import { COMMENT_COLUMNS, commentFromRow } from "@/lib/comments/live-rows";
import type {
  CommentPin,
  DesignComment,
  MentionPerson,
} from "@/lib/comments/schema";
import { getDb } from "@/lib/db/client";
import { sharedWith, visibleTo } from "@/lib/db/queries/designs";
import { isStoredAvatarUrl } from "@/lib/storage/keys";

// Comments are raw SQL, like the save statement: each write is one
// statement that checks access on the design row itself (visibleTo, with
// the unaliased `designs`), so there's no window between a check and the
// write. Rows come back in the live query's shape (COMMENT_COLUMNS).

const columns = sql.raw(COMMENT_COLUMNS);

const toComments = (rows: readonly unknown[]): DesignComment[] =>
  rows
    .map(commentFromRow)
    .filter((comment): comment is DesignComment => comment !== null);

// Whether a user may be mentioned on a design: its owner, or someone it's
// shared with, through an accepted invite or a verified email that matches
// (the rule sharedWith in ./designs uses). Raw SQL for the two ids.
export const isMentionable = (userId: SQL, designId: SQL): SQL => sql`(
  ${userId} = (SELECT owner_id FROM designs WHERE designs.id = ${designId})
  OR EXISTS (
    SELECT 1 FROM design_shares AS share
    WHERE share.design_id = ${designId}
      AND (share.user_id = ${userId} OR share.email = (
        SELECT lower(email) FROM neon_auth."user"
        WHERE id = ${userId} AND "emailVerified"
      ))
  )
)`;

// A uuid[] literal; the ids are already checked to be uuids
export const uuidArray = (ids: readonly string[]): SQL =>
  sql`ARRAY[${sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql`, `
  )}]::uuid[]`;

// The people a comment's tokens may name, as a CTE body: only when the
// author may mention (canMention: `design` has can_mention) and each one is
// mentionable. Their names go into the comment's `mentions`.
const mentionedPeople = (mentionIds: readonly string[]): SQL =>
  mentionIds.length === 0
    ? sql`SELECT NULL::uuid AS id, NULL::text AS name WHERE false`
    : sql`
      SELECT person.id, person.name FROM neon_auth."user" AS person, design
      WHERE design.can_mention
        AND person.id = ANY(${uuidArray(mentionIds)})
        AND ${isMentionable(sql`person.id`, sql`design.id`)}`;

const MENTION_NAMES = sql`COALESCE((SELECT jsonb_object_agg(people.id, people.name) FROM people), '{}'::jsonb)`;

// The design, when the viewer may open it, and whether they may mention
// people on it (the owner and people it's shared with)
const visibleDesign = (designId: string, viewerId: string): SQL => sql`
  SELECT id,
    (owner_id = ${viewerId}::uuid OR ${sharedWith(viewerId)}) AS can_mention
  FROM designs
  WHERE id = ${designId}::uuid AND ${visibleTo(viewerId)}`;

const mentionedIds = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((id): id is string => typeof id === "string")
    : [];

// The people who can be mentioned on a design (the composer's list): never
// their emails
export const listMentionable = async (
  designId: string
): Promise<MentionPerson[]> => {
  const result = await getDb().execute<{
    id: string;
    name: string;
    image: string | null;
  }>(sql`
    SELECT person.id, person.name, person.image
    FROM neon_auth."user" AS person
    WHERE person.id IN (
        SELECT owner_id FROM designs
        WHERE id = ${designId}::uuid AND owner_id IS NOT NULL
        UNION
        SELECT user_id FROM design_shares
        WHERE design_id = ${designId}::uuid AND user_id IS NOT NULL
      )
      OR (person."emailVerified" AND lower(person.email) IN (
        SELECT email FROM design_shares WHERE design_id = ${designId}::uuid
      ))
    ORDER BY person.name, person.id
  `);
  return result.rows.map((row) => ({
    id: row.id,
    image:
      row.image !== null &&
      (row.image.startsWith("https://") || isStoredAvatarUrl(row.image))
        ? row.image
        : null,
    name: row.name,
  }));
};

// Every comment on the design, threads and replies, in no order (see
// groupThreads). Only for people who may open it: the caller checks.
export const listDesignComments = async (
  designId: string
): Promise<DesignComment[]> => {
  const result = await getDb().execute(
    sql`SELECT ${columns} FROM design_comments WHERE design_id = ${designId}::uuid`
  );
  return toComments(result.rows);
};

export type PostCommentResult =
  // `mentioned`: the people it mentions, for their emails (not the author)
  | { status: "posted"; comment: DesignComment; mentioned: string[] }
  // The design isn't there for the viewer, or the thread isn't on it
  | { status: "not-found" }
  // COMMENT_RATE_LIMIT in COMMENT_RATE_WINDOW_MINUTES already
  | { status: "rate-limited" }
  // MAX_COMMENTS_PER_DESIGN already
  | { status: "full" };

export interface NewCommentInput {
  designId: string;
  viewer: Viewer;
  body: string;
  // Who its tokens mention (see checkBody)
  mentionIds: readonly string[];
  // A new thread with its pin, or a reply to a thread
  target: { pin: CommentPin } | { threadId: string };
}

const NO_ANCHOR = {
  anchorHeight: null,
  anchorWidth: null,
  anchorX: null,
  anchorY: null,
  elementId: null,
};

// A new thread's pin as column values; all null for a reply
const pinColumns = (pin: CommentPin | null) =>
  pin
    ? { ...(pin.anchor ?? NO_ANCHOR), pageId: pin.pageId, x: pin.x, y: pin.y }
    : { ...NO_ANCHOR, pageId: null, x: null, y: null };

// Posts a comment in one statement: the design must be visible to the
// viewer (whose account must still exist), a reply's thread must be one of
// its threads, and the viewer and the design must be under their limits.
// The author's name and picture are copied from the account, and the names
// of the people it may mention from theirs; each of those gets a
// comment_mentions row for their email.
export const postComment = async ({
  body,
  designId,
  mentionIds,
  target,
  viewer,
}: NewCommentInput): Promise<PostCommentResult> => {
  const threadId = "threadId" in target ? target.threadId : null;
  const pin = pinColumns("pin" in target ? target.pin : null);
  // A reply needs its thread; a thread needs nothing more
  const threadCheck: SQL = threadId
    ? sql`EXISTS (SELECT 1 FROM thread)`
    : sql`true`;

  const result = await getDb().execute<{
    found: number;
    thread_found: number;
    recent: number;
    total: number;
    comment: unknown;
    mentioned: unknown;
  }>(sql`
    WITH design AS (${visibleDesign(designId, viewer.id)}),
    author AS (
      SELECT id FROM neon_auth."user" WHERE id = ${viewer.id}::uuid
    ),
    thread AS (
      SELECT comment.id FROM design_comments AS comment
      JOIN design ON comment.design_id = design.id
      WHERE comment.id = ${threadId}::uuid AND comment.thread_id IS NULL
    ),
    counts AS (
      SELECT
        (SELECT count(*) FROM design_comments
          WHERE author_id = ${viewer.id}::uuid
            AND created_at > now() - make_interval(mins => ${COMMENT_RATE_WINDOW_MINUTES})
        )::int AS recent,
        (SELECT count(*) FROM design_comments
          WHERE design_id = ${designId}::uuid)::int AS total
    ),
    people AS (${mentionedPeople(mentionIds)}),
    inserted AS (
      INSERT INTO design_comments (
        design_id, thread_id, author_id, author_name, author_image, body,
        mentions, page_id, x, y, element_id, anchor_x, anchor_y,
        anchor_width, anchor_height
      )
      SELECT design.id, ${threadId}::uuid, author.id, ${viewer.name},
        ${viewer.image}, ${body}, ${MENTION_NAMES}, ${pin.pageId}::text,
        ${pin.x}::real,
        ${pin.y}::real, ${pin.elementId}::text, ${pin.anchorX}::real,
        ${pin.anchorY}::real, ${pin.anchorWidth}::real,
        ${pin.anchorHeight}::real
      FROM design, author, counts
      WHERE counts.recent < ${COMMENT_RATE_LIMIT}
        AND counts.total < ${MAX_COMMENTS_PER_DESIGN}
        AND ${threadCheck}
      RETURNING ${columns}, design_id
    ),
    mentioned AS (
      INSERT INTO comment_mentions (comment_id, design_id, user_id)
      SELECT inserted.id, inserted.design_id, people.id
      FROM inserted, people
      WHERE people.id <> ${viewer.id}::uuid
      RETURNING user_id
    )
    SELECT
      (SELECT count(*) FROM design)::int AS found,
      (SELECT count(*) FROM thread)::int AS thread_found,
      counts.recent, counts.total,
      (SELECT row_to_json(inserted) FROM inserted) AS comment,
      (SELECT COALESCE(json_agg(user_id), '[]'::json) FROM mentioned)
        AS mentioned
    FROM counts
  `);

  const [row] = result.rows;
  if (!row?.found || (threadId && !row.thread_found)) {
    return { status: "not-found" };
  }
  const comment = row.comment ? commentFromRow(row.comment) : null;
  if (comment) {
    return {
      comment,
      mentioned: mentionedIds(row.mentioned),
      status: "posted",
    };
  }
  if (row.recent >= COMMENT_RATE_LIMIT) {
    return { status: "rate-limited" };
  }
  if (row.total >= MAX_COMMENTS_PER_DESIGN) {
    return { status: "full" };
  }
  // The account is gone
  return { status: "not-found" };
};

// The design the comment is on, when the viewer may open it and `rule`
// holds (raw SQL about the unaliased `designs`, and the comment row being
// changed as `design_comments`)
const onVisibleDesign = (
  designId: string,
  viewerId: string,
  rule: SQL
): SQL => sql`
  design_comments.design_id = ${designId}::uuid
  AND EXISTS (
    SELECT 1 FROM designs
    WHERE designs.id = ${designId}::uuid AND ${visibleTo(viewerId)} AND ${rule}
  )`;

const changedComment = (rows: readonly unknown[]): DesignComment | null => {
  const [row] = rows;
  return row ? commentFromRow(row) : null;
};

// New text for a comment, by its author (canEditComment), with its
// mentions worked out again. Returns it and the people it mentions now but
// didn't before (for their emails); null when there's no such comment for
// them.
export const editComment = async ({
  body,
  commentId,
  designId,
  mentionIds,
  viewerId,
}: {
  body: string;
  commentId: string;
  designId: string;
  mentionIds: readonly string[];
  viewerId: string;
}): Promise<{ comment: DesignComment; mentioned: string[] } | null> => {
  const result = await getDb().execute<{
    comment: unknown;
    mentioned: unknown;
  }>(sql`
    WITH design AS (${visibleDesign(designId, viewerId)}),
    people AS (${mentionedPeople(mentionIds)}),
    changed AS (
      UPDATE design_comments
      SET body = ${body}, mentions = ${MENTION_NAMES}, edited_at = now()
      WHERE design_comments.id = ${commentId}::uuid
        AND design_comments.author_id = ${viewerId}::uuid
        AND design_comments.design_id IN (SELECT id FROM design)
      RETURNING ${columns}, design_id
    ),
    mentioned AS (
      INSERT INTO comment_mentions (comment_id, design_id, user_id)
      SELECT changed.id, changed.design_id, people.id
      FROM changed, people
      WHERE people.id <> ${viewerId}::uuid
      ON CONFLICT DO NOTHING
      RETURNING user_id
    )
    SELECT (SELECT row_to_json(changed) FROM changed) AS comment,
      (SELECT COALESCE(json_agg(user_id), '[]'::json) FROM mentioned)
        AS mentioned
  `);
  const [row] = result.rows;
  const comment = row?.comment ? commentFromRow(row.comment) : null;
  return comment ? { comment, mentioned: mentionedIds(row?.mentioned) } : null;
};

// Resolves or reopens a thread (canResolveThread: the owner, people it's
// shared with, and whoever started it). Resolving one again keeps when it
// was first resolved. Null when there's no such thread for them.
export const resolveThread = async ({
  designId,
  resolved,
  threadId,
  viewerId,
}: {
  designId: string;
  resolved: boolean;
  threadId: string;
  viewerId: string;
}): Promise<DesignComment | null> => {
  const result = await getDb().execute(sql`
    UPDATE design_comments SET
      resolved_at = CASE WHEN ${resolved} THEN COALESCE(resolved_at, now()) END,
      resolved_by = CASE WHEN ${resolved}
        THEN (SELECT id FROM neon_auth."user" WHERE id = ${viewerId}::uuid)
      END
    WHERE design_comments.id = ${threadId}::uuid
      AND design_comments.thread_id IS NULL
      AND ${onVisibleDesign(
        designId,
        viewerId,
        sql`(designs.owner_id = ${viewerId}::uuid OR ${sharedWith(viewerId)} OR design_comments.author_id = ${viewerId}::uuid)`
      )}
    RETURNING ${columns}
  `);
  return changedComment(result.rows);
};

// Deletes a comment, by its author or the design's owner
// (canDeleteComment); a thread's replies go with it. False when there's no
// such comment for them.
export const deleteComment = async ({
  commentId,
  designId,
  viewerId,
}: {
  commentId: string;
  designId: string;
  viewerId: string;
}): Promise<boolean> => {
  const result = await getDb().execute(sql`
    DELETE FROM design_comments
    WHERE design_comments.id = ${commentId}::uuid
      AND ${onVisibleDesign(
        designId,
        viewerId,
        sql`(design_comments.author_id = ${viewerId}::uuid OR designs.owner_id = ${viewerId}::uuid)`
      )}
    RETURNING design_comments.id
  `);
  return result.rows.length > 0;
};
