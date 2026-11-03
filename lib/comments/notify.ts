import "server-only";
import { sql } from "drizzle-orm";

import {
  MENTION_EMAIL_DESIGN_GAP_MINUTES,
  MENTION_EMAILS_PER_AUTHOR_HOUR,
  MENTION_EMAILS_PER_RECIPIENT_HOUR,
  ON_DESIGN_SECONDS,
} from "@/lib/comments/limits";
import { commentPath } from "@/lib/comments/link";
import { getDb } from "@/lib/db/client";
import { isMentionable, uuidArray } from "@/lib/db/queries/comments";
import { commentMentionEmail } from "@/lib/email/comment-mention";
import { sendEmail } from "@/lib/email/send";

interface Recipient extends Record<string, unknown> {
  user_id: string;
  email: string;
  design_id: string;
  design_name: string;
  author_name: string;
  body: string;
  mentions: unknown;
  thread_id: string;
  // Mention emails the comment's author caused in the last hour
  author_sent: number;
}

const names = (value: unknown): Record<string, string> =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? Object.fromEntries(
        Object.entries(value).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string"
        )
      )
    : {};

// Emails the people a comment just mentioned, after the response has gone
// out. Each must still be mentionable on the design and not its author;
// nobody whose editor is on the design right now gets one (they see it
// arrive), nor anyone mailed about this design in the last
// MENTION_EMAIL_DESIGN_GAP_MINUTES or MENTION_EMAILS_PER_RECIPIENT_HOUR
// times in the last hour, and an author causes at most
// MENTION_EMAILS_PER_AUTHOR_HOUR an hour. There's no reply-to, so the
// author's address stays private. Rows of those it went to get emailed_at;
// the rest stay null (skipped), including everything when no email is set
// up. Failures are dropped: the comment is posted either way.
export const notifyMentions = async ({
  commentId,
  origin,
  userIds,
}: {
  commentId: string;
  origin: string;
  userIds: readonly string[];
}): Promise<void> => {
  if (userIds.length === 0) {
    return;
  }
  const db = getDb();
  const result = await db.execute<Recipient>(sql`
    SELECT mention.user_id, person.email, comment.design_id,
      design.name AS design_name, comment.author_name, comment.body,
      comment.mentions, COALESCE(comment.thread_id, comment.id) AS thread_id,
      (SELECT count(*) FROM comment_mentions AS sent
        JOIN design_comments AS cause ON cause.id = sent.comment_id
        WHERE cause.author_id = comment.author_id
          AND sent.emailed_at > now() - interval '1 hour'
      )::int AS author_sent
    FROM comment_mentions AS mention
    JOIN design_comments AS comment ON comment.id = mention.comment_id
    JOIN designs AS design ON design.id = comment.design_id
    JOIN neon_auth."user" AS person ON person.id = mention.user_id
    WHERE mention.comment_id = ${commentId}::uuid
      AND mention.user_id = ANY(${uuidArray(userIds)})
      AND mention.emailed_at IS NULL
      AND mention.user_id IS DISTINCT FROM comment.author_id
      AND ${isMentionable(sql`mention.user_id`, sql`comment.design_id`)}
      AND NOT EXISTS (
        SELECT 1 FROM design_presence AS here
        WHERE here.design_id = comment.design_id
          AND here.user_id = mention.user_id
          AND here.seen_at > now() - make_interval(secs => ${ON_DESIGN_SECONDS})
      )
      AND NOT EXISTS (
        SELECT 1 FROM comment_mentions AS recent
        WHERE recent.user_id = mention.user_id
          AND recent.design_id = comment.design_id
          AND recent.emailed_at > now() - make_interval(mins => ${MENTION_EMAIL_DESIGN_GAP_MINUTES})
      )
      AND (
        SELECT count(*) FROM comment_mentions AS recent
        WHERE recent.user_id = mention.user_id
          AND recent.emailed_at > now() - interval '1 hour'
      ) < ${MENTION_EMAILS_PER_RECIPIENT_HOUR}
    ORDER BY mention.created_at, mention.user_id
  `);

  const allowance = Math.max(
    0,
    MENTION_EMAILS_PER_AUTHOR_HOUR - (result.rows[0]?.author_sent ?? 0)
  );
  const recipients = result.rows.slice(0, allowance);
  const delivered = await Promise.all(
    recipients.map((recipient) =>
      sendEmail({
        ...commentMentionEmail({
          authorName: recipient.author_name,
          body: recipient.body,
          designName: recipient.design_name,
          mentions: names(recipient.mentions),
          url: new URL(
            commentPath(recipient.design_id, recipient.thread_id),
            origin
          ).href,
        }),
        to: recipient.email,
      })
    )
  );
  const sent = recipients
    .filter((_, index) => delivered[index])
    .map((recipient) => recipient.user_id);
  if (sent.length > 0) {
    await db.execute(sql`
      UPDATE comment_mentions SET emailed_at = now()
      WHERE comment_id = ${commentId}::uuid
        AND user_id = ANY(${uuidArray(sent)})
    `);
  }
};
