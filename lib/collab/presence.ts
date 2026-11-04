import { z } from "zod";

import { isStoredAvatarUrl } from "@/lib/storage/keys";

// A presence row as the live query delivers it (jsonb parsed, unvalidated)
export interface LivePresenceRow {
  client_id: string;
  name: string;
  color: string;
  // Avatar URL of a signed-in person (set by the server); null for guests
  image: string | null;
  x: number | null;
  y: number | null;
  selection: unknown;
  drag: unknown;
  seen_at: Date;
  // The page they're on; null for the first page and for sessions from
  // before pages (missing from queries sealed before then)
  page_id?: string | null;
}

// Where elements are mid-drag for the person moving them, so others see
// them move before the edit is committed on drop
export interface DragMove {
  elementId: string;
  x: number;
  y: number;
}

export interface DragPreview {
  moves: DragMove[];
}

// Larger selections still move for everyone on drop, just not live
export const MAX_DRAG_MOVES = 100;

// What one editor session tells the others, about every 100 ms while active
export interface PresenceState {
  name: string;
  color: string;
  // Pointer in page coordinates; null when it's off the canvas
  x: number | null;
  y: number | null;
  selection: string[];
  drag: DragPreview | null;
  // The page on screen
  pageId: string;
}

export interface Peer {
  clientId: string;
  name: string;
  color: string;
  image: string | null;
  cursor: { x: number; y: number } | null;
  selection: string[];
  drag: DragPreview | null;
  // The page they're on; null is the first page
  pageId: string | null;
}

// A session that stops heartbeating (closed laptop, crashed tab) disappears
export const PRESENCE_STALE_MS = 15_000;
export const PRESENCE_INTERVAL_MS = 100;
export const PRESENCE_HEARTBEAT_MS = 5000;

const finite = z.number().finite();

const dragMoveSchema = z.object({
  elementId: z.string().min(1).max(64),
  x: finite,
  y: finite,
});

export const dragPreviewSchema = z.union([
  z.object({ moves: z.array(dragMoveSchema).min(1).max(MAX_DRAG_MOVES) }),
  // Sessions from before multi-select drag one element at a time
  dragMoveSchema.transform((move): DragPreview => ({ moves: [move] })),
]);

const selectionSchema = z.array(z.string().min(1).max(64)).max(500);

// Only https avatars from the auth provider, or ones uploaded here (both
// set by the server from the account)
const avatarUrl = (image: unknown): string | null =>
  typeof image === "string" &&
  (image.startsWith("https://") || isStoredAvatarUrl(image))
    ? image
    : null;

const comparePeers = (a: Peer, b: Peer) =>
  a.name.localeCompare(b.name) || a.clientId.localeCompare(b.clientId);

// Everyone else on the design who has been seen recently. `now` is the
// server's clock as estimated by this browser, since seen_at comes from it.
export const peersFromRows = (
  rows: readonly LivePresenceRow[],
  selfId: string,
  now: number
): Peer[] =>
  rows
    .filter(
      (row) =>
        row.client_id !== selfId &&
        now - new Date(row.seen_at).getTime() < PRESENCE_STALE_MS
    )
    .map((row) => {
      const selection = selectionSchema.safeParse(row.selection);
      const drag = dragPreviewSchema.safeParse(row.drag);
      return {
        clientId: row.client_id,
        color: row.color,
        cursor:
          row.x === null || row.y === null ? null : { x: row.x, y: row.y },
        drag: drag.success ? drag.data : null,
        image: avatarUrl(row.image),
        name: row.name,
        pageId: typeof row.page_id === "string" ? row.page_id : null,
        selection: selection.success ? selection.data : [],
      };
    })
    .toSorted(comparePeers);

// The page a peer is on: theirs, or the first page when it says none
export const peerPageId = (peer: Peer, firstPageId: string): string =>
  peer.pageId ?? firstPageId;

// The people on one page: whose cursors and selections that page shows
export const peersOnPage = (
  peers: readonly Peer[],
  pageId: string,
  firstPageId: string
): Peer[] => peers.filter((peer) => peerPageId(peer, firstPageId) === pageId);

export interface PresenceSender {
  update: (patch: Partial<PresenceState>) => void;
  dispose: () => void;
}

// Sends the latest presence state, at most every `intervalMs` and one
// request at a time (intermediate states are skipped, only the latest
// matters), plus a heartbeat so idle sessions stay visible
export const createPresenceSender = ({
  initial,
  send,
  intervalMs = PRESENCE_INTERVAL_MS,
  heartbeatMs = PRESENCE_HEARTBEAT_MS,
}: {
  initial: PresenceState;
  send: (state: PresenceState) => Promise<void>;
  intervalMs?: number;
  heartbeatMs?: number;
}): PresenceSender => {
  let latest = initial;
  let version = 1;
  let sentVersion = 0;
  let lastSentAt = 0;
  let inFlight = false;
  let disposed = false;

  const flush = async () => {
    if (disposed || inFlight || version === sentVersion) {
      return;
    }
    inFlight = true;
    const sending = version;
    lastSentAt = Date.now();
    try {
      await send(latest);
    } catch {
      // Presence is best-effort; the next tick or heartbeat retries
    }
    inFlight = false;
    sentVersion = sending;
  };
  const flushSoon = () => {
    flush().catch(() => null);
  };

  const ticker = setInterval(flushSoon, intervalMs);
  const heartbeat = setInterval(() => {
    version += 1;
  }, heartbeatMs);
  flushSoon();

  return {
    dispose: () => {
      disposed = true;
      clearInterval(ticker);
      clearInterval(heartbeat);
    },
    update: (patch) => {
      latest = { ...latest, ...patch };
      version += 1;
      // Idle for a while: send right away instead of on the next tick
      if (Date.now() - lastSentAt >= intervalMs) {
        flushSoon();
      }
    },
  };
};
