import { canMention } from "@/lib/auth/access";
import { getDesignAccess } from "@/lib/auth/design-access";
import { listMentionable } from "@/lib/db/queries/comments";

const NO_STORE = { "Cache-Control": "private, no-store" };

const json = (body: unknown, status = 200) =>
  Response.json(body, { headers: NO_STORE, status });

// Who a comment can mention: the design's owner and the people it's shared
// with, as id, name and picture (never their emails). Only for those who
// may mention (canMention); anyone else gets a 404, so a public design's
// visitors can't list who it's shared with.
export const GET = async (
  _request: Request,
  context: RouteContext<"/api/designs/[id]/people">
): Promise<Response> => {
  const { id } = await context.params;
  const { role } = await getDesignAccess(id);
  if (!canMention(role)) {
    return json({ error: "Not found" }, 404);
  }
  return json({ people: await listMentionable(id) });
};
