import "server-only";
import { createRealtime, rawSql } from "@neon/realtime/server";
import type { RealtimeServer, SealedLiveQuery } from "@neon/realtime/server";

import type { LivePresenceRow } from "@/lib/collab/presence";
import { getEnv } from "@/lib/env";
import type {
  LiveConfig,
  LiveElementRow,
  LivePageRow,
} from "@/lib/realtime/rows";

// Live queries are raw SQL rather than Drizzle: the Drizzle adapter needs
// every selected key to equal its column name, and ours are camelCase.
// Rows are sorted in the browser (by position, then id), so there is no
// ORDER BY to keep in sync with JavaScript string order.
const pageQuery = (designId: string) =>
  rawSql<LivePageRow>(
    "SELECT name, width, height, background, version, visibility, restore_seq, restored_by_name FROM designs WHERE id = $1",
    [designId]
  );

const elementsQuery = (designId: string) =>
  rawSql<LiveElementRow>(
    "SELECT id, position, data FROM design_elements WHERE design_id = $1",
    [designId]
  );

const presenceQuery = (designId: string) =>
  rawSql<LivePresenceRow>(
    "SELECT client_id, name, color, image, x, y, selection, drag, seen_at FROM design_presence WHERE design_id = $1",
    [designId]
  );

let instance: RealtimeServer<unknown> | null | undefined;

// Null when Realtime isn't configured: the editor then works single-player
export const getRealtime = (): RealtimeServer<unknown> | null => {
  if (instance === undefined) {
    const env = getEnv();
    instance =
      env.NEON_REALTIME_SECRET && env.NEON_REALTIME_URL
        ? createRealtime({
            db: new URL(env.DATABASE_URL).pathname.slice(1),
            debugMode: process.env.NODE_ENV === "development",
            secret: env.NEON_REALTIME_SECRET,
          })
        : null;
  }
  return instance;
};

// Sealing is local crypto (no network). A sealed query is a short-lived
// bearer token for exactly this query and design id.
export const sealPageQuery = (
  designId: string
): Promise<SealedLiveQuery<LivePageRow>> | null =>
  getRealtime()?.seal({ query: pageQuery(designId) }) ?? null;

export const sealElementsQuery = (
  designId: string
): Promise<SealedLiveQuery<LiveElementRow>> | null =>
  getRealtime()?.seal({ query: elementsQuery(designId) }) ?? null;

export const sealPresenceQuery = (
  designId: string
): Promise<SealedLiveQuery<LivePresenceRow>> | null =>
  getRealtime()?.seal({ query: presenceQuery(designId) }) ?? null;

export const getLiveConfig = async (
  designId: string
): Promise<LiveConfig | null> => {
  const url = getEnv().NEON_REALTIME_URL;
  const page = sealPageQuery(designId);
  const elements = sealElementsQuery(designId);
  const presence = sealPresenceQuery(designId);
  if (!(url && page && elements && presence)) {
    return null;
  }
  return {
    elements: await elements,
    page: await page,
    presence: await presence,
    url,
  };
};
