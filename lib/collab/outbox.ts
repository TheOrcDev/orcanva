import {
  hasUnsentWrites,
  unechoedTransactions,
  unsentWrites,
} from "@/lib/collab/sync-state";
import type {
  BatchOutcome,
  BatchSeqs,
  PendingWrites,
  Touched,
} from "@/lib/collab/sync-state";
import type { Size } from "@/lib/document/geometry";
import type { Background, DesignElement } from "@/lib/document/schema";

export type SaveStatus = "saved" | "unsaved" | "saving" | "error";

export interface ElementWrite {
  data: DesignElement;
  // "create" upserts; "update" only touches a row that still exists
  mode: "create" | "update";
  position: string;
  pageId: string;
}

export interface PageWrite {
  id: string;
  // As for elements
  mode: "create" | "update";
  position: string;
  background: Background;
}

// The body of POST /api/designs/[id]/changes (see changesPayload)
export interface ChangesRequest {
  clientId: string;
  deletes: string[];
  elements: ElementWrite[];
  name?: string;
  pages?: PageWrite[];
  pageDeletes?: string[];
  size?: Size;
}

export class SaveError extends Error {
  readonly retryable: boolean;
  // The server's answer; null when it couldn't be reached
  readonly status: number | null;

  constructor(
    message: string,
    retryable: boolean,
    status: number | null = null
  ) {
    super(message);
    this.name = "SaveError";
    this.retryable = retryable;
    this.status = status;
  }
}

export type SendChanges = (
  designId: string,
  request: ChangesRequest,
  options: { keepalive: boolean }
) => Promise<{ txid: string }>;

// Resolves once the live queries have applied the transaction; rejects on
// timeout or when the live connection goes away
export type AwaitSync = (txid: string, touched: Touched) => Promise<void>;

export interface OutboxHost {
  clientId: string;
  designId: string;
  // Whether there are live queries at all (Realtime is configured)
  live: boolean;
  getPending: () => PendingWrites;
  // The batch reached the server (see BatchOutcome)
  settle: (batch: BatchSeqs, outcome: BatchOutcome, txid: string) => void;
  // The live queries have applied this transaction
  echo: (txid: string) => void;
  // The server refused the batch for good
  drop: (batch: BatchSeqs) => void;
  setStatus: (status: SaveStatus) => void;
  onRefused?: (error: Error) => void;
}

export interface Outbox {
  // Sends pending writes soon (throttled)
  schedule: () => void;
  // Sends everything now and resolves once it has all reached the server
  flush: () => Promise<void>;
  // Plugs in (or removes) the live queries' check; written transactions
  // still waiting for their echo are awaited on the new connection
  // Best-effort send for tab close; false when it could not be sent
  flushOnExit: () => boolean;
  isDirty: () => boolean;
  setAwaitSync: (awaitSync: AwaitSync | null) => void;
  dispose: () => void;
}

// Often enough that others see slider scrubs and typing live, rarely enough
// to coalesce a burst of changes into one request
export const FLUSH_INTERVAL_MS = 100;
const RETRY_DELAYS_MS = [1000, 2000, 5000, 10_000];

export const buildBatch = (
  clientId: string,
  pending: PendingWrites
): { request: ChangesRequest; seqs: BatchSeqs } => {
  const elements: ElementWrite[] = [];
  const deletes: string[] = [];
  const elementSeqs = new Map<string, number>();
  for (const [id, write] of pending.elements) {
    elementSeqs.set(id, write.seq);
    if (write.entry) {
      elements.push({
        data: write.entry.element,
        mode: write.create ? "create" : "update",
        pageId: write.entry.pageId,
        position: write.entry.position,
      });
    } else {
      deletes.push(id);
    }
  }
  const pages: PageWrite[] = [];
  const pageDeletes: string[] = [];
  const pageSeqs = new Map<string, number>();
  for (const [id, write] of pending.pages) {
    pageSeqs.set(id, write.seq);
    if (write.entry) {
      pages.push({
        background: write.entry.background,
        id,
        mode: write.create ? "create" : "update",
        position: write.entry.position,
      });
    } else {
      pageDeletes.push(id);
    }
  }

  const request: ChangesRequest = { clientId, deletes, elements };
  if (pages.length > 0) {
    request.pages = pages;
  }
  if (pageDeletes.length > 0) {
    request.pageDeletes = pageDeletes;
  }
  if (pending.size) {
    request.size = pending.size.value;
  }
  if (pending.name) {
    request.name = pending.name.value;
  }
  return {
    request,
    seqs: {
      elements: elementSeqs,
      name: pending.name?.seq ?? null,
      pages: pageSeqs,
      size: pending.size?.seq ?? null,
    },
  };
};

// Sends local writes in order, one request at a time. Whatever changes while
// a request is out goes in the next one.
export const createOutbox = (
  host: OutboxHost,
  send: SendChanges,
  intervalMs = FLUSH_INTERVAL_MS
): Outbox => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<boolean> | null = null;
  let awaitSync: AwaitSync | null = null;
  let failures = 0;
  let disposed = false;

  const draining = new Set<string>();

  const isDirty = () => hasUnsentWrites(host.getPending());

  // What became of a committed batch, as far as the live queries go
  const confirm = async (
    txid: string,
    request: ChangesRequest
  ): Promise<BatchOutcome> => {
    if (!host.live) {
      return "final";
    }
    const sync = awaitSync;
    if (!sync) {
      return "committed";
    }
    try {
      await sync(txid, {
        elements: request.elements.length + request.deletes.length > 0,
        page: request.size !== undefined || request.name !== undefined,
        pages:
          (request.pages?.length ?? 0) + (request.pageDeletes?.length ?? 0) > 0,
      });
      return "echoed";
    } catch {
      // Same connection and still no echo: stop waiting. A new connection
      // will be asked again.
      return awaitSync === sync ? "final" : "committed";
    }
  };

  const awaitEcho = async (sync: AwaitSync, txid: string, touched: Touched) => {
    draining.add(txid);
    try {
      await sync(txid, touched);
    } catch {
      if (awaitSync !== sync) {
        // The connection changed; the next one asks again
        return;
      }
    } finally {
      draining.delete(txid);
    }
    host.echo(txid);
  };

  // Waits for every committed-but-unechoed transaction on the current
  // connection, e.g. writes made while it was reconnecting
  const drainEchoes = () => {
    const sync = awaitSync;
    if (!sync) {
      return;
    }
    for (const [txid, touched] of unechoedTransactions(host.getPending())) {
      if (!draining.has(txid)) {
        awaitEcho(sync, txid, touched).catch(() => null);
      }
    }
  };

  // Resolves true when the batch reached the server
  const sendBatch = async (): Promise<boolean> => {
    const { request, seqs } = buildBatch(
      host.clientId,
      unsentWrites(host.getPending())
    );
    host.setStatus("saving");
    let txid: string;
    try {
      ({ txid } = await send(host.designId, request, { keepalive: false }));
    } catch (error) {
      const refused = error instanceof SaveError && !error.retryable;
      if (refused) {
        failures = 0;
        host.drop(seqs);
        host.onRefused?.(error);
        return true;
      }
      failures += 1;
      host.setStatus("error");
      return false;
    }
    failures = 0;
    host.settle(seqs, await confirm(txid, request), txid);
    return true;
  };

  const flush = async (): Promise<void> => {
    clearTimeout(timer);
    timer = undefined;
    clearTimeout(retryTimer);
    retryTimer = undefined;
    if (disposed) {
      return;
    }
    if (inFlight) {
      await inFlight;
      return flush();
    }
    if (!isDirty()) {
      host.setStatus("saved");
      return;
    }

    inFlight = sendBatch();
    let reached = false;
    try {
      reached = await inFlight;
    } finally {
      inFlight = null;
    }
    if (reached) {
      return flush();
    }
    const delay =
      RETRY_DELAYS_MS[Math.min(failures, RETRY_DELAYS_MS.length) - 1] ??
      RETRY_DELAYS_MS[0];
    retryTimer = setTimeout(() => {
      flush().catch(() => host.setStatus("error"));
    }, delay);
  };

  const schedule = () => {
    // While failing, the retry timer owns the next attempt
    if (disposed || timer !== undefined || retryTimer !== undefined) {
      return;
    }
    host.setStatus("saving");
    timer = setTimeout(() => {
      timer = undefined;
      flush().catch(() => host.setStatus("error"));
    }, intervalMs);
  };

  const flushOnExit = () => {
    if (!isDirty()) {
      return true;
    }
    const { request } = buildBatch(
      host.clientId,
      unsentWrites(host.getPending())
    );
    try {
      send(host.designId, request, { keepalive: true }).catch(() => null);
      return true;
    } catch {
      return false;
    }
  };

  const dispose = () => {
    disposed = true;
    clearTimeout(timer);
    clearTimeout(retryTimer);
  };

  return {
    dispose,
    flush,
    flushOnExit,
    isDirty,
    schedule,
    setAwaitSync: (next) => {
      awaitSync = next;
      drainEchoes();
    },
  };
};

// Browsers cap keepalive request bodies at 64 KiB in total
const KEEPALIVE_BODY_LIMIT = 60_000;

const isRetryableStatus = (status: number) =>
  status >= 500 || status === 408 || status === 429;

const postChanges = async (
  designId: string,
  body: string,
  keepalive: boolean
): Promise<{ txid: string }> => {
  let response: Response;
  try {
    response = await fetch(`/api/designs/${designId}/changes`, {
      body,
      headers: { "Content-Type": "application/json" },
      keepalive,
      method: "POST",
    });
  } catch {
    throw new SaveError("Couldn't reach the server", true);
  }
  if (!response.ok) {
    throw new SaveError(
      `Save failed with ${response.status}`,
      isRetryableStatus(response.status),
      response.status
    );
  }
  const result: unknown = await response.json();
  const txid =
    typeof result === "object" && result !== null && "txid" in result
      ? String(result.txid)
      : "";
  return { txid };
};

// Throws synchronously when a tab-close save can't fit in keepalive, so
// flushOnExit can tell the page to warn before unloading
export const sendChangesRequest: SendChanges = (
  designId,
  request,
  { keepalive }
) => {
  const body = JSON.stringify(request);
  if (keepalive && body.length > KEEPALIVE_BODY_LIMIT) {
    throw new Error("Design changes are too large to save while closing");
  }
  return postChanges(designId, body, keepalive);
};
