// How much one comment may hold
export const MAX_COMMENT_LENGTH = 2000;
export const MAX_MENTIONS = 10;

// What one account may post, then 429
export const COMMENT_RATE_LIMIT = 30;
export const COMMENT_RATE_WINDOW_MINUTES = 10;

// Comments on one design, replies included; checked in the insert
export const MAX_COMMENTS_PER_DESIGN = 1000;

// Mention emails: each author's per hour, each person's per hour, and at
// most one per person and design in this many minutes
export const MENTION_EMAILS_PER_AUTHOR_HOUR = 30;
export const MENTION_EMAILS_PER_RECIPIENT_HOUR = 20;
export const MENTION_EMAIL_DESIGN_GAP_MINUTES = 15;

// Someone whose editor was seen on the design this recently is there now,
// and sees the comment arrive: no email
export const ON_DESIGN_SECONDS = 15;
