import { composePages } from "@/lib/collab/changeset";
import type {
  DesignContent,
  Entry,
  PageEntry,
  PageView,
  Writes,
} from "@/lib/collab/changeset";
import { isDeepEqual } from "@/lib/collab/equal";
import type { Size } from "@/lib/document/geometry";
import type { DesignElement } from "@/lib/document/schema";

// What the server has, as last seen (from the live queries, or from our own
// confirmed writes when Realtime is off)
export interface SyncedState extends DesignContent {
  name: string;
}

// A local write the live queries haven't shown back yet. `txid` is null
// until the server commits it; after that it stays on top of the synced
// state until the live query has applied that transaction, because a fresh
// live result can briefly lag behind the database. `create` marks writes
// that bring an element or page into existence: those upsert, while updates
// only touch a row that still exists, so a delete by someone else wins.
export interface PendingRow<T> {
  entry: T | null;
  create: boolean;
  seq: number;
  txid: string | null;
}

export type PendingElement = PendingRow<Entry>;
export type PendingPage = PendingRow<PageEntry>;

export interface PendingValue<T> {
  value: T;
  seq: number;
  txid: string | null;
}

export interface PendingWrites {
  elements: ReadonlyMap<string, PendingElement>;
  pages: ReadonlyMap<string, PendingPage>;
  size: PendingValue<Size> | null;
  name: PendingValue<string> | null;
}

// The sequence numbers a batch sent, to settle exactly those writes later
export interface BatchSeqs {
  elements: ReadonlyMap<string, number>;
  pages: ReadonlyMap<string, number>;
  size: number | null;
  name: number | null;
}

// What happened to a sent batch:
// - "echoed": committed and already applied by the live queries
// - "committed": committed, but not seen on the live queries yet
// - "final": committed, and there are no live queries to wait for
export type BatchOutcome = "echoed" | "committed" | "final";

// The live queries a transaction shows up on: elements, pages, and the
// design row ("page": its size and name)
export interface Touched {
  elements: boolean;
  pages: boolean;
  page: boolean;
}

export const EMPTY_PENDING: PendingWrites = {
  elements: new Map(),
  name: null,
  pages: new Map(),
  size: null,
};

const isUnsent = (write: { txid: string | null } | null): boolean =>
  write !== null && write.txid === null;

const unsentRows = <T>(
  rows: ReadonlyMap<string, PendingRow<T>>
): Map<string, PendingRow<T>> =>
  new Map([...rows].filter(([, write]) => isUnsent(write)));

// Writes the server hasn't committed yet
export const unsentWrites = (pending: PendingWrites): PendingWrites => ({
  elements: unsentRows(pending.elements),
  name: isUnsent(pending.name) ? pending.name : null,
  pages: unsentRows(pending.pages),
  size: isUnsent(pending.size) ? pending.size : null,
});

export const hasUnsentWrites = (pending: PendingWrites): boolean =>
  [...pending.elements.values()].some(isUnsent) ||
  [...pending.pages.values()].some(isUnsent) ||
  isUnsent(pending.name) ||
  isUnsent(pending.size);

// Committed transactions still waiting to show up on the live queries, and
// which queries they touched
export const unechoedTransactions = (
  pending: PendingWrites
): Map<string, Touched> => {
  const transactions = new Map<string, Touched>();
  const touch = (txid: string | null, key: keyof Touched) => {
    if (txid !== null) {
      const touched = transactions.get(txid) ?? {
        elements: false,
        page: false,
        pages: false,
      };
      transactions.set(txid, { ...touched, [key]: true });
    }
  };
  for (const write of pending.elements.values()) {
    touch(write.txid, "elements");
  }
  for (const write of pending.pages.values()) {
    touch(write.txid, "pages");
  }
  touch(pending.size?.txid ?? null, "page");
  touch(pending.name?.txid ?? null, "page");
  return transactions;
};

export const syncedFrom = (
  content: DesignContent,
  name: string
): SyncedState => ({ ...content, name });

const queueRows = <T>(
  rows: ReadonlyMap<string, PendingRow<T>>,
  writes: ReadonlyMap<string, T | null>,
  existing: ReadonlySet<string>,
  seq: number
): ReadonlyMap<string, PendingRow<T>> => {
  if (writes.size === 0) {
    return rows;
  }
  const next = new Map(rows);
  for (const [id, entry] of writes) {
    const previous = next.get(id);
    next.set(id, {
      create:
        entry !== null && (!existing.has(id) || previous?.create === true),
      entry,
      seq,
      txid: null,
    });
  }
  return next;
};

// Queues local writes on top of what's already pending. `existing` holds the
// element and page ids that existed before these writes.
export const addWrites = (
  pending: PendingWrites,
  writes: Writes,
  existing: { elements: ReadonlySet<string>; pages: ReadonlySet<string> },
  seq: number
): PendingWrites => {
  if (
    writes.elements.size === 0 &&
    writes.pages.size === 0 &&
    writes.size === null
  ) {
    return pending;
  }
  return {
    ...pending,
    elements: queueRows(
      pending.elements,
      writes.elements,
      existing.elements,
      seq
    ),
    pages: queueRows(pending.pages, writes.pages, existing.pages, seq),
    size: writes.size ? { seq, txid: null, value: writes.size } : pending.size,
  };
};

export const addNameWrite = (
  pending: PendingWrites,
  name: string,
  seq: number
): PendingWrites => ({ ...pending, name: { seq, txid: null, value: name } });

type Update = <T extends { seq: number; txid: string | null }>(
  write: T
) => T | null;

const mapRows = <T>(
  rows: ReadonlyMap<string, PendingRow<T>>,
  seqs: ReadonlyMap<string, number>,
  update: Update
): Map<string, PendingRow<T>> => {
  const next = new Map(rows);
  for (const [id, seq] of seqs) {
    const write = next.get(id);
    if (write?.seq === seq) {
      const updated = update(write);
      if (updated) {
        next.set(id, updated);
      } else {
        next.delete(id);
      }
    }
  }
  return next;
};

// Applies `update` to the writes this batch sent; writes edited again since
// were not in it and stay as they are
const mapBatch = (
  pending: PendingWrites,
  batch: BatchSeqs,
  update: Update
): PendingWrites => ({
  elements: mapRows(pending.elements, batch.elements, update),
  name: pending.name?.seq === batch.name ? update(pending.name) : pending.name,
  pages: mapRows(pending.pages, batch.pages, update),
  size: pending.size?.seq === batch.size ? update(pending.size) : pending.size,
});

const promoteRows = <T>(
  synced: ReadonlyMap<string, T>,
  rows: ReadonlyMap<string, PendingRow<T>>,
  seqs: ReadonlyMap<string, number>
): Map<string, T> => {
  const next = new Map(synced);
  for (const [id, seq] of seqs) {
    const write = rows.get(id);
    if (write?.seq === seq) {
      if (write.entry) {
        next.set(id, write.entry);
      } else {
        next.delete(id);
      }
    }
  }
  return next;
};

// The batch's values become the synced state: used when the live queries
// can't (yet) deliver them back, so dropping the overlay later can't revert
const promote = (
  pending: PendingWrites,
  synced: SyncedState,
  batch: BatchSeqs
): SyncedState => ({
  elements: promoteRows(synced.elements, pending.elements, batch.elements),
  name: pending.name?.seq === batch.name ? pending.name.value : synced.name,
  pages: promoteRows(synced.pages, pending.pages, batch.pages),
  size: pending.size?.seq === batch.size ? pending.size.value : synced.size,
});

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
): PendingWrites => ({
  elements: new Map(
    [...pending.elements].filter(([, write]) => write.txid !== txid)
  ),
  name: pending.name?.txid === txid ? null : pending.name,
  pages: new Map([...pending.pages].filter(([, write]) => write.txid !== txid)),
  size: pending.size?.txid === txid ? null : pending.size,
});

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

const overlay = <T>(
  synced: ReadonlyMap<string, T>,
  rows: ReadonlyMap<string, PendingRow<T>>
): Map<string, T> => {
  const next = new Map(synced);
  for (const [id, write] of rows) {
    if (write.entry) {
      next.set(id, write.entry);
    } else {
      next.delete(id);
    }
  }
  return next;
};

// The design as this window should show it: the server's state with our
// unconfirmed writes on top
export const shownContent = (
  synced: SyncedState,
  pending: PendingWrites
): DesignContent => ({
  elements: overlay(synced.elements, pending.elements),
  pages: overlay(synced.pages, pending.pages),
  size: pending.size?.value ?? synced.size,
});

// The pages to show: the server's state with our unconfirmed writes on
// top. Elements under a local gesture (`held`) keep their on-screen state
// so a node never jumps mid-drag. Unchanged elements and pages keep their
// object identity, so only what really changed re-renders.
export const rebase = (
  synced: SyncedState,
  pending: PendingWrites,
  current: readonly PageView[],
  held: ReadonlySet<string>
): PageView[] => {
  const content = shownContent(synced, pending);
  const shown = new Map<string, { element: DesignElement; page: PageView }>();
  for (const page of current) {
    for (const element of page.doc.document.elements) {
      shown.set(element.id, { element, page });
    }
  }
  const elements = new Map(content.elements);
  for (const id of held) {
    const found = shown.get(id);
    if (found) {
      elements.set(id, {
        element: found.element,
        pageId: found.page.id,
        position: found.page.doc.positions.get(id) ?? "",
      });
    }
  }
  const reuse = (element: DesignElement) => {
    const previous = shown.get(element.id)?.element;
    return previous !== undefined && isDeepEqual(previous, element)
      ? previous
      : element;
  };
  return composePages({ ...content, elements }, current, reuse);
};
