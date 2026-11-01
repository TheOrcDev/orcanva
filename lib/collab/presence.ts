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
}

// Where an element is mid-drag for the person moving it, so others see it
// move before the edit is committed on drop
export interface DragPreview {
  elementId: string;
  x: number;
  y: number;
}

// What one editor session tells the others, about every 100 ms while active
export interface PresenceState {
  name: string;
  color: string;
  // Pointer in page coordinates; null when it's off the canvas
  x: number | null;
  y: number | null;
  selection: string[];
  drag: DragPreview | null;
}

export interface Peer {
  clientId: string;
  name: string;
  color: string;
  image: string | null;
  cursor: { x: number; y: number } | null;
  selection: string[];
  drag: DragPreview | null;
}

// A session that stops heartbeating (closed laptop, crashed tab) disappears
export const PRESENCE_STALE_MS = 15_000;
export const PRESENCE_INTERVAL_MS = 100;
export const PRESENCE_HEARTBEAT_MS = 5000;

const finite = z.number().finite();

export const dragPreviewSchema = z.object({
  elementId: z.string().min(1).max(64),
  x: finite,
  y: finite,
});

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
        selection: selection.success ? selection.data : [],
      };
    })
    .toSorted(comparePeers);

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
