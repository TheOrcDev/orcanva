import "server-only";
import { createRealtime, rawSql } from "@neon/realtime/server";
import type { RealtimeServer, SealedLiveQuery } from "@neon/realtime/server";

import type { LivePresenceRow } from "@/lib/collab/presence";
import { COMMENT_COLUMNS } from "@/lib/comments/live-rows";
import type { LiveCommentRow } from "@/lib/comments/live-rows";
import { getEnv } from "@/lib/env";
import type {
  LiveConfig,
  LiveElementRow,
  LivePageRow,
  LivePagesRow,
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

// Each page's place and background
const pagesQuery = (designId: string) =>
  rawSql<LivePagesRow>(
    "SELECT id, position, background FROM design_pages WHERE design_id = $1",
    [designId]
  );

// Every page's elements, for editors that know pages; editors from before
// pages show one page, so theirs holds only the first page's (rows written
// without a page are on it too)
const elementsQuery = (designId: string, onlyPage: string | null) =>
  onlyPage === null
    ? rawSql<LiveElementRow>(
        "SELECT id, position, data, page_id FROM design_elements WHERE design_id = $1",
        [designId]
      )
    : rawSql<LiveElementRow>(
        "SELECT id, position, data FROM design_elements WHERE design_id = $1 AND (page_id = $2 OR page_id IS NULL)",
        [designId, onlyPage]
      );

const presenceQuery = (designId: string) =>
  rawSql<LivePresenceRow>(
    "SELECT client_id, name, color, image, x, y, selection, drag, seen_at FROM design_presence WHERE design_id = $1",
    [designId]
  );

// Threads and replies in one table, so this stays a single-table query
const commentsQuery = (designId: string) =>
  rawSql<LiveCommentRow>(
    `SELECT ${COMMENT_COLUMNS} FROM design_comments WHERE design_id = $1`,
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

export const sealPagesQuery = (
  designId: string
): Promise<SealedLiveQuery<LivePagesRow>> | null =>
  getRealtime()?.seal({ query: pagesQuery(designId) }) ?? null;

// `onlyPage`: the first page's id, for an editor from before pages; null
// for every page
export const sealElementsQuery = (
  designId: string,
  onlyPage: string | null
): Promise<SealedLiveQuery<LiveElementRow>> | null =>
  getRealtime()?.seal({ query: elementsQuery(designId, onlyPage) }) ?? null;

export const sealPresenceQuery = (
  designId: string
): Promise<SealedLiveQuery<LivePresenceRow>> | null =>
  getRealtime()?.seal({ query: presenceQuery(designId) }) ?? null;

export const sealCommentsQuery = (
  designId: string
): Promise<SealedLiveQuery<LiveCommentRow>> | null =>
  getRealtime()?.seal({ query: commentsQuery(designId) }) ?? null;

// Every query an editor subscribes to, sealed together so they expire
// together
export const getLiveConfig = async (
  designId: string
): Promise<LiveConfig | null> => {
  const url = getEnv().NEON_REALTIME_URL;
  const page = sealPageQuery(designId);
  const pages = sealPagesQuery(designId);
  const elements = sealElementsQuery(designId, null);
  const presence = sealPresenceQuery(designId);
  const comments = sealCommentsQuery(designId);
  if (!(url && page && pages && elements && presence && comments)) {
    return null;
  }
  return {
    comments: await comments,
    elements: await elements,
    page: await page,
    pages: await pages,
    presence: await presence,
    url,
  };
};
