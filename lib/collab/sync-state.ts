import { composeDocument, pageOf } from "@/lib/collab/changeset";
import type {
  EditorDocument,
  Entry,
  PageSettings,
  Writes,
} from "@/lib/collab/changeset";
import { isDeepEqual } from "@/lib/collab/equal";
import type { DesignElement } from "@/lib/document/schema";

// What the server has, as last seen (from the live queries, or from our own
// confirmed writes when Realtime is off)
export interface SyncedState {
  elements: ReadonlyMap<string, Entry>;
  page: PageSettings;
  name: string;
}

// A local write the live queries haven't shown back yet. `txid` is null
// until the server commits it; after that it stays on top of the synced
// state until the live query has applied that transaction, because a fresh
// live result can briefly lag behind the database. `create` marks writes
// that bring an element into existence: those upsert, while updates only
// touch a row that still exists, so a delete by someone else wins.
export interface PendingElement {
  entry: Entry | null;
  create: boolean;
  seq: number;
  txid: string | null;
}

export interface PendingValue<T> {
  value: T;
  seq: number;
  txid: string | null;
}

export interface PendingWrites {
  elements: ReadonlyMap<string, PendingElement>;
  page: PendingValue<PageSettings> | null;
  name: PendingValue<string> | null;
}

// The sequence numbers a batch sent, to settle exactly those writes later
export interface BatchSeqs {
  elements: ReadonlyMap<string, number>;
  page: number | null;
  name: number | null;
}

// What happened to a sent batch:
// - "echoed": committed and already applied by the live queries
// - "committed": committed, but not seen on the live queries yet
// - "final": committed, and there are no live queries to wait for
export type BatchOutcome = "echoed" | "committed" | "final";

export const EMPTY_PENDING: PendingWrites = {
  elements: new Map(),
  name: null,
  page: null,
};

const isUnsent = (write: { txid: string | null } | null): boolean =>
  write !== null && write.txid === null;

// Writes the server hasn't committed yet
export const unsentWrites = (pending: PendingWrites): PendingWrites => ({
  elements: new Map(
    [...pending.elements].filter(([, write]) => isUnsent(write))
  ),
  name: isUnsent(pending.name) ? pending.name : null,
  page: isUnsent(pending.page) ? pending.page : null,
});

export const hasUnsentWrites = (pending: PendingWrites): boolean =>
  [...pending.elements.values()].some(isUnsent) ||
  isUnsent(pending.name) ||
  isUnsent(pending.page);

// Committed transactions still waiting to show up on the live queries, and
// which queries they touched
export const unechoedTransactions = (
  pending: PendingWrites
): Map<string, { elements: boolean; page: boolean }> => {
  const transactions = new Map<string, { elements: boolean; page: boolean }>();
  const touch = (txid: string | null, key: "elements" | "page") => {
    if (txid !== null) {
      const touched = transactions.get(txid) ?? {
        elements: false,
        page: false,
      };
      transactions.set(txid, { ...touched, [key]: true });
    }
  };
  for (const write of pending.elements.values()) {
    touch(write.txid, "elements");
  }
  touch(pending.page?.txid ?? null, "page");
  touch(pending.name?.txid ?? null, "page");
  return transactions;
};

export const syncedFromDocument = (
  editor: EditorDocument,
  name: string
): SyncedState => ({
  elements: new Map(
    editor.document.elements.map((element) => [
      element.id,
      { element, position: editor.positions.get(element.id) ?? "" },
    ])
  ),
  name,
  page: pageOf(editor.document),
});

// Queues local writes on top of what's already pending. `existing` holds the
// element ids that existed before these writes.
export const addWrites = (
  pending: PendingWrites,
  writes: Writes,
  existing: ReadonlySet<string>,
  seq: number
): PendingWrites => {
  if (writes.elements.size === 0 && writes.page === null) {
    return pending;
  }
  const elements = new Map(pending.elements);
  for (const [id, entry] of writes.elements) {
    const previous = elements.get(id);
    elements.set(id, {
      create:
        entry !== null && (!existing.has(id) || previous?.create === true),
      entry,
      seq,
      txid: null,
    });
  }
  return {
    ...pending,
    elements,
    page: writes.page ? { seq, txid: null, value: writes.page } : pending.page,
  };
};

export const addNameWrite = (
  pending: PendingWrites,
  name: string,
  seq: number
): PendingWrites => ({ ...pending, name: { seq, txid: null, value: name } });

// Applies `update` to the writes this batch sent; writes edited again since
// were not in it and stay as they are
const mapBatch = (
  pending: PendingWrites,
  batch: BatchSeqs,
  update: <T extends { seq: number; txid: string | null }>(write: T) => T | null
): PendingWrites => {
  const elements = new Map(pending.elements);
  for (const [id, seq] of batch.elements) {
    const write = elements.get(id);
    if (write?.seq === seq) {
      const next = update(write);
      if (next) {
        elements.set(id, next);
      } else {
        elements.delete(id);
      }
    }
  }
  return {
    elements,
    name:
      pending.name?.seq === batch.name ? update(pending.name) : pending.name,
    page:
      pending.page?.seq === batch.page ? update(pending.page) : pending.page,
  };
};

// The batch's values become the synced state: used when the live queries
// can't (yet) deliver them back, so dropping the overlay later can't revert
const promote = (
  pending: PendingWrites,
  synced: SyncedState,
  batch: BatchSeqs
): SyncedState => {
  const elements = new Map(synced.elements);
  for (const [id, seq] of batch.elements) {
    const write = pending.elements.get(id);
    if (write?.seq === seq) {
      if (write.entry) {
        elements.set(id, write.entry);
      } else {
        elements.delete(id);
      }
    }
  }
  return {
    elements,
    name: pending.name?.seq === batch.name ? pending.name.value : synced.name,
    page: pending.page?.seq === batch.page ? pending.page.value : synced.page,
  };
};

// A batch reached the server (see BatchOutcome)
export const settleBatch = (
  pending: PendingWrites,
  synced: SyncedState,
  batch: BatchSeqs,
  outcome: BatchOutcome,
  txid: string
): { pending: PendingWrites; synced: SyncedState } => {
  if (outcome === "echoed") {
    return { pending: mapBatch(pending, batch, () => null), synced };
  }
  const next =
    outcome === "final"
      ? mapBatch(pending, batch, () => null)
      : mapBatch(pending, batch, (write) => ({ ...write, txid }));
  return { pending: next, synced: promote(pending, synced, batch) };
};

// The live queries have applied a transaction: its writes can stop
// overriding what they show
export const echoTransaction = (
  pending: PendingWrites,
  txid: string
): PendingWrites => {
  const elements = new Map(
    [...pending.elements].filter(([, write]) => write.txid !== txid)
  );
  return {
    elements,
    name: pending.name?.txid === txid ? null : pending.name,
    page: pending.page?.txid === txid ? null : pending.page,
  };
};

// A batch was refused: forget those writes so the view falls back to the
// server's version
export const dropBatch = (
  pending: PendingWrites,
  batch: BatchSeqs
): PendingWrites => mapBatch(pending, batch, () => null);

export const currentName = (
  synced: SyncedState,
  pending: PendingWrites
): string => pending.name?.value ?? synced.name;

const reuse = <T>(previous: T | undefined, next: T): T =>
  previous !== undefined && isDeepEqual(previous, next) ? previous : next;

// The document to show: the server's state with our unconfirmed writes on
// top. Elements under a local gesture (`held`) keep their on-screen state so
// a node never jumps mid-drag. Unchanged elements keep their object
// identity, so only what really changed re-renders.
export const rebase = (
  synced: SyncedState,
  pending: PendingWrites,
  current: EditorDocument,
  held: ReadonlySet<string>
): EditorDocument => {
  const shown = new Map<string, DesignElement>(
    current.document.elements.map((element) => [element.id, element])
  );
  const entries = new Map(synced.elements);
  for (const [id, write] of pending.elements) {
    if (write.entry) {
      entries.set(id, write.entry);
    } else {
      entries.delete(id);
    }
  }
  for (const id of held) {
    const element = shown.get(id);
    if (element) {
      entries.set(id, {
        element,
        position: current.positions.get(id) ?? "",
      });
    }
  }

  const stable = [...entries.values()].map((entry) => ({
    element: reuse(shown.get(entry.element.id), entry.element),
    position: entry.position,
  }));
  const page = pending.page?.value ?? synced.page;
  const next = composeDocument(
    {
      ...page,
      background: reuse(current.document.background, page.background),
    },
    stable
  );

  const unchanged =
    next.document.width === current.document.width &&
    next.document.height === current.document.height &&
    next.document.background === current.document.background &&
    next.document.elements.length === current.document.elements.length &&
    next.document.elements.every(
      (element, index) =>
        element === current.document.elements[index] &&
        next.positions.get(element.id) === current.positions.get(element.id)
    );
  return unchanged ? current : next;
};
