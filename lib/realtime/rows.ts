import type { SealedLiveQuery } from "@neon/realtime/client";

import type { LivePresenceRow } from "@/lib/collab/presence";
import type { LiveCommentRow } from "@/lib/comments/live-rows";

// Rows as the live queries deliver them. jsonb arrives parsed but not
// validated, so the editor checks it before use (see lib/collab/live-rows).
export interface LivePageRow {
  name: string;
  width: number;
  height: number;
  background: unknown;
  version: number;
  // "private" or "public": open editors react when the owner changes it
  visibility: string;
  // Goes up with every version restore; editors then clear their undo
  // history. Missing from rows sealed before version history existed.
  restore_seq?: number;
  restored_by_name?: string | null;
}

export interface LiveElementRow {
  id: string;
  position: string;
  data: unknown;
  // The page it's on; null for rows written by code from before pages
  // (the first page), and missing from queries sealed for such editors
  page_id?: string | null;
}

// Every live query an editor subscribes to
export const LIVE_QUERY_NAMES = [
  "page",
  "elements",
  "presence",
  "comments",
] as const;

export type LiveQueryName = (typeof LIVE_QUERY_NAMES)[number];

// A design's sealed live queries, by name
export interface LiveQueries {
  page: SealedLiveQuery<LivePageRow>;
  elements: SealedLiveQuery<LiveElementRow>;
  presence: SealedLiveQuery<LivePresenceRow>;
  comments: SealedLiveQuery<LiveCommentRow>;
}

// Everything the browser needs to subscribe to a design's live queries
export interface LiveConfig extends LiveQueries {
  url: string;
}
