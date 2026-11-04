import { z } from "zod";

import { getDesignAccess } from "@/lib/auth/design-access";
import { getFirstPageId } from "@/lib/db/queries/designs";
import { LIVE_QUERY_NAMES, LIVE_QUERY_SHAPE } from "@/lib/realtime/rows";
import type { LiveQueryName } from "@/lib/realtime/rows";
import {
  sealCommentsQuery,
  sealElementsQuery,
  sealPageQuery,
  sealPagesQuery,
  sealPresenceQuery,
} from "@/lib/realtime/server";

const queryName = z.enum(LIVE_QUERY_NAMES);

// Editors ask for all their queries in one request ({ queries }). Tabs
// opened before that asked for one at a time ({ query }), and still do
// until they reload, so both shapes are served.
const shape = z.number().int().min(1).optional();
const renewPayload = z.union([
  z.object({ query: queryName, v: shape }),
  z.object({
    queries: z.array(queryName).min(1).max(LIVE_QUERY_NAMES.length),
    v: shape,
  }),
]);

// `onlyPage`: the page an editor from before pages shows (see
// sealElementsQuery); null for editors that know pages
const SEALERS = {
  comments: (designId) => sealCommentsQuery(designId),
  elements: (designId, onlyPage) => sealElementsQuery(designId, onlyPage),
  page: (designId) => sealPageQuery(designId),
  pages: (designId) => sealPagesQuery(designId),
  presence: (designId) => sealPresenceQuery(designId),
} satisfies Record<
  LiveQueryName,
  (designId: string, onlyPage: string | null) => unknown
>;

// Sealed queries are bearer tokens: never cache them anywhere
const NO_STORE = { "Cache-Control": "private, no-store" };

const json = (body: unknown, status = 200) =>
  Response.json(body, { headers: NO_STORE, status });

const NOT_CONFIGURED = { error: "Realtime is not configured" };

// Fresh sealed queries for a design's live subscriptions, which expire after
// a minute. A Route Handler because Server Actions queue behind each other.
export const POST = async (
  request: Request,
  context: RouteContext<"/api/designs/[id]/live">
): Promise<Response> => {
  const { id } = await context.params;
  // A sealed query is a bearer token for the design's rows: only for people
  // who may open it, checked again on every renewal (about once a minute),
  // once per request however many queries it renews
  const { role } = await getDesignAccess(id);
  if (!role) {
    return json({ error: "Not found" }, 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }
  const parsed = renewPayload.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Unknown query" }, 422);
  }

  // An editor from before pages only sees the first page as it is now
  const names =
    "query" in parsed.data
      ? [parsed.data.query]
      : [...new Set(parsed.data.queries)];
  const knowsPages = (parsed.data.v ?? 1) >= LIVE_QUERY_SHAPE;
  const onlyPage =
    knowsPages || !names.includes("elements") ? null : await getFirstPageId(id);

  // One query: the sealed query itself
  if ("query" in parsed.data) {
    const sealed = SEALERS[parsed.data.query](id, onlyPage);
    return sealed ? json(await sealed) : json(NOT_CONFIGURED, 503);
  }

  // Several: { sealed: { [query]: sealed query } }
  const sealing = names.map((name) => SEALERS[name](id, onlyPage));
  if (sealing.some((sealed) => sealed === null)) {
    return json(NOT_CONFIGURED, 503);
  }
  const sealed = await Promise.all(sealing);
  return json({
    sealed: Object.fromEntries(
      names.map((name, index) => [name, sealed[index]])
    ),
  });
};
