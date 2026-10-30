import type { SealedLiveQuery } from "@neon/realtime/client";

// Rows as the live queries deliver them. jsonb arrives parsed but not
// validated, so the editor checks it before use (see lib/collab/live-rows).
export interface LivePageRow {
  name: string;
  width: number;
  height: number;
  background: unknown;
  version: number;
}

export interface LiveElementRow {
  id: string;
  position: string;
  data: unknown;
}

export type LiveQueryName = "page" | "elements";

// Everything the browser needs to subscribe to a design's live queries
export interface LiveConfig {
  url: string;
  page: SealedLiveQuery<LivePageRow>;
  elements: SealedLiveQuery<LiveElementRow>;
}
