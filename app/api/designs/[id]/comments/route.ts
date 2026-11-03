import { after } from "next/server";

import { getDesignAccess } from "@/lib/auth/design-access";
import { getViewer } from "@/lib/auth/server";
import { checkBody } from "@/lib/comments/body";
import {
  COMMENT_RATE_WINDOW_MINUTES,
  MAX_COMMENTS_PER_DESIGN,
} from "@/lib/comments/limits";
import { notifyMentions } from "@/lib/comments/notify";
import { newCommentSchema } from "@/lib/comments/schema";
import { listDesignComments, postComment } from "@/lib/db/queries/comments";
import { isDesignId } from "@/lib/db/queries/designs";
import { appOrigin } from "@/lib/email/origin";

const NO_STORE = { "Cache-Control": "private, no-store" };

const json = (body: unknown, status = 200, headers: HeadersInit = NO_STORE) =>
  Response.json(body, { headers, status });

// Comments are read by anyone who can open the design, and written by
// people signed in with a role on it; guests choose their own names and
// have no account to rate-limit. Route Handlers rather than Server Actions,
// so they don't queue behind uploads.

// Every comment on the design (the editor gets them with the page and then
// from the live query; this is for anything else)
export const GET = async (
  _request: Request,
  context: RouteContext<"/api/designs/[id]/comments">
): Promise<Response> => {
  const { id } = await context.params;
  const { role } = await getDesignAccess(id);
  if (!role) {
    return json({ error: "Not found" }, 404);
  }
  return json({ comments: await listDesignComments(id) });
};

// A new thread with its pin, or a reply to one. Returns the comment, which
// the editor shows right away rather than waiting for the live query; the
// people it mentions are emailed after the response.
export const POST = async (
  request: Request,
  context: RouteContext<"/api/designs/[id]/comments">
): Promise<Response> => {
  const { id } = await context.params;
  if (!isDesignId(id)) {
    return json({ error: "Not found" }, 404);
  }
  const viewer = await getViewer();
  if (!viewer) {
    return json({ error: "Sign in to comment" }, 401);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const parsed = newCommentSchema.safeParse(payload);
  if (!parsed.success) {
    return json({ error: "Invalid comment" }, 422);
  }
  const checked = checkBody(parsed.data.body);
  if (!checked.ok) {
    return json({ error: checked.error }, 422);
  }

  const result = await postComment({
    body: checked.body,
    designId: id,
    mentionIds: checked.mentions,
    target: parsed.data,
    viewer,
  });
  switch (result.status) {
    case "posted": {
      if (result.mentioned.length > 0) {
        const origin = await appOrigin();
        after(() =>
          notifyMentions({
            commentId: result.comment.id,
            origin,
            userIds: result.mentioned,
          })
        );
      }
      return json({ comment: result.comment }, 201);
    }
    case "rate-limited": {
      return json(
        {
          error: "You've posted a lot of comments. Try again in a few minutes.",
        },
        429,
        { ...NO_STORE, "Retry-After": String(COMMENT_RATE_WINDOW_MINUTES * 60) }
      );
    }
    case "full": {
      return json(
        {
          error: `This design has ${MAX_COMMENTS_PER_DESIGN.toLocaleString("en")} comments, the most it can hold. Delete some to add more.`,
        },
        409
      );
    }
    case "not-found": {
      return json({ error: "Not found" }, 404);
    }
    default: {
      return result satisfies never;
    }
  }
};
