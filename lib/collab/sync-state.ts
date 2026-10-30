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

// A local write the server hasn't confirmed yet. `create` marks writes that
// bring an element into existence: those upsert, while updates only touch a
// row that still exists, so a delete by someone else wins.
export interface PendingElement {
  entry: Entry | null;
  create: boolean;
  seq: number;
}

export interface PendingWrites {
  elements: ReadonlyMap<string, PendingElement>;
  page: { value: PageSettings; seq: number } | null;
  name: { value: string; seq: number } | null;
}

// The sequence numbers a batch sent, to settle exactly those writes later
export interface BatchSeqs {
  elements: ReadonlyMap<string, number>;
  page: number | null;
  name: number | null;
}

export const EMPTY_PENDING: PendingWrites = {
  elements: new Map(),
  name: null,
  page: null,
};

export const isPendingEmpty = (pending: PendingWrites): boolean =>
  pending.elements.size === 0 && pending.page === null && pending.name === null;

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
    });
  }
  return {
    ...pending,
    elements,
    page: writes.page ? { seq, value: writes.page } : pending.page,
  };
};

export const addNameWrite = (
  pending: PendingWrites,
  name: string,
  seq: number
): PendingWrites => ({ ...pending, name: { seq, value: name } });

const withoutBatch = (
  pending: PendingWrites,
  batch: BatchSeqs
): PendingWrites => {
  const elements = new Map(pending.elements);
  for (const [id, seq] of batch.elements) {
    if (elements.get(id)?.seq === seq) {
      elements.delete(id);
    }
  }
  return {
    elements,
    name: pending.name?.seq === batch.name ? null : pending.name,
    page: pending.page?.seq === batch.page ? null : pending.page,
  };
};

// A batch reached the server. Writes edited again since stay pending. With
// `promote`, the written values also become the synced state (used when no
// live query will deliver them back).
export const settleBatch = (
  pending: PendingWrites,
  synced: SyncedState,
  batch: BatchSeqs,
  promote: boolean
): { pending: PendingWrites; synced: SyncedState } => {
  if (!promote) {
    return { pending: withoutBatch(pending, batch), synced };
  }
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
    pending: withoutBatch(pending, batch),
    synced: {
      elements,
      name: pending.name?.seq === batch.name ? pending.name.value : synced.name,
      page: pending.page?.seq === batch.page ? pending.page.value : synced.page,
    },
  };
};

// A batch was refused: forget those writes so the view falls back to the
// server's version
export const dropBatch = (
  pending: PendingWrites,
  batch: BatchSeqs
): PendingWrites => withoutBatch(pending, batch);

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
