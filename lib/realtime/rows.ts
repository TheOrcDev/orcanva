import type { SealedLiveQuery } from "@neon/realtime/client";

import type { LivePresenceRow } from "@/lib/collab/presence";

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
}

export type LiveQueryName = "page" | "elements" | "presence";

// Everything the browser needs to subscribe to a design's live queries
export interface LiveConfig {
  url: string;
  page: SealedLiveQuery<LivePageRow>;
  elements: SealedLiveQuery<LiveElementRow>;
  presence: SealedLiveQuery<LivePresenceRow>;
}
