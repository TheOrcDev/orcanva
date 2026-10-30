import { z } from "zod";

import { isDesignId } from "@/lib/db/queries/designs";
import type { LiveQueryName } from "@/lib/realtime/rows";
import {
  sealElementsQuery,
  sealPageQuery,
  sealPresenceQuery,
} from "@/lib/realtime/server";

const renewPayload = z.object({
  query: z.enum(["page", "elements", "presence"]),
});

const SEALERS = {
  elements: sealElementsQuery,
  page: sealPageQuery,
  presence: sealPresenceQuery,
} satisfies Record<LiveQueryName, (designId: string) => unknown>;

// Sealed queries are bearer tokens: never cache them anywhere
const NO_STORE = { "Cache-Control": "private, no-store" };

const json = (body: unknown, status = 200) =>
  Response.json(body, { headers: NO_STORE, status });

// Fresh sealed queries for a design's live subscriptions, which expire after
// a minute. A Route Handler because Server Actions queue behind each other.
export const POST = async (
  request: Request,
  context: RouteContext<"/api/designs/[id]/live">
): Promise<Response> => {
  const { id } = await context.params;
  if (!isDesignId(id)) {
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

  const sealed = SEALERS[parsed.data.query](id);
  if (!sealed) {
    return json({ error: "Realtime is not configured" }, 503);
  }
  return json(await sealed);
};
