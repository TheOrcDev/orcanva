import { after } from "next/server";
import { z } from "zod";

import { getViewer } from "@/lib/auth/server";
import { checkBody } from "@/lib/comments/body";
import { notifyMentions } from "@/lib/comments/notify";
import { commentPatchSchema } from "@/lib/comments/schema";
import {
  deleteComment,
  editComment,
  resolveThread,
} from "@/lib/db/queries/comments";
import { isDesignId } from "@/lib/db/queries/designs";
import { appOrigin } from "@/lib/email/origin";

const NO_STORE = { "Cache-Control": "private, no-store" };

const json = (body: unknown, status = 200) =>
  Response.json(body, { headers: NO_STORE, status });

const commentId = z.uuid();

// Each statement checks for itself that the viewer may open the design and
// may do this to the comment (lib/auth/access.ts): its author changes its
// text, its author or the design's owner deletes it, and the owner, people
// it's shared with or the thread's author resolve a thread. Anything else
// is a 404, as if there were no such comment.
const target = async (
  context: RouteContext<"/api/designs/[id]/comments/[commentId]">
) => {
  const params = await context.params;
  if (
    !(isDesignId(params.id) && commentId.safeParse(params.commentId).success)
  ) {
    return null;
  }
  const viewer = await getViewer();
  return viewer
    ? { commentId: params.commentId, designId: params.id, viewerId: viewer.id }
    : null;
};

// New text ({ body }), or resolving or reopening a thread ({ resolved }).
// People an edit newly mentions are emailed after the response.
export const PATCH = async (
  request: Request,
  context: RouteContext<"/api/designs/[id]/comments/[commentId]">
): Promise<Response> => {
  const found = await target(context);
  if (!found) {
    return json({ error: "Not found" }, 404);
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const parsed = commentPatchSchema.safeParse(payload);
  if (!parsed.success) {
    return json({ error: "Invalid change" }, 422);
  }

  if ("resolved" in parsed.data) {
    const thread = await resolveThread({
      designId: found.designId,
      resolved: parsed.data.resolved,
      threadId: found.commentId,
      viewerId: found.viewerId,
    });
    return thread
      ? json({ comment: thread })
      : json({ error: "Not found" }, 404);
  }

  const checked = checkBody(parsed.data.body);
  if (!checked.ok) {
    return json({ error: checked.error }, 422);
  }
  const edited = await editComment({
    ...found,
    body: checked.body,
    mentionIds: checked.mentions,
  });
  if (!edited) {
    return json({ error: "Not found" }, 404);
  }
  // Only people it didn't mention before
  if (edited.mentioned.length > 0) {
    const origin = await appOrigin();
    after(() =>
      notifyMentions({
        commentId: edited.comment.id,
        origin,
        userIds: edited.mentioned,
      })
    );
  }
  return json({ comment: edited.comment });
};

export const DELETE = async (
  _request: Request,
  context: RouteContext<"/api/designs/[id]/comments/[commentId]">
): Promise<Response> => {
  const found = await target(context);
  if (!(found && (await deleteComment(found)))) {
    return json({ error: "Not found" }, 404);
  }
  return new Response(null, { headers: NO_STORE, status: 204 });
};
