import { assignPositions, comparePositioned } from "@/lib/collab/positions";
import type { Positions } from "@/lib/collab/positions";
import { DOCUMENT_VERSION } from "@/lib/document/schema";
import type {
  Background,
  DesignDocument,
  DesignElement,
} from "@/lib/document/schema";

// An element as stored: its data plus its z-order key
export interface Entry {
  element: DesignElement;
  position: string;
}

export interface PageSettings {
  background: Background;
  height: number;
  width: number;
}

// The rendered document plus every element's z-order key. The elements
// array is always sorted by those keys.
export interface EditorDocument {
  document: DesignDocument;
  positions: Positions;
}

export interface Change<T> {
  before: T;
  after: T;
}

// What one edit (or one undo step) did, element by element. null means
// "didn't exist": a null before is a create, a null after a delete.
export interface ChangeSet {
  elements: ReadonlyMap<string, Change<Entry | null>>;
  page: Change<PageSettings> | null;
}

// The states to write: each touched element (null = delete) and the page
export interface Writes {
  elements: ReadonlyMap<string, Entry | null>;
  page: PageSettings | null;
}

export type Direction = "undo" | "redo";

export const EMPTY_CHANGES: ChangeSet = { elements: new Map(), page: null };

export const isEmptyChangeSet = (changes: ChangeSet): boolean =>
  changes.elements.size === 0 && changes.page === null;

export const pageOf = (document: DesignDocument): PageSettings => ({
  background: document.background,
  height: document.height,
  width: document.width,
});

const samePage = (a: PageSettings, b: PageSettings): boolean =>
  a.width === b.width && a.height === b.height && a.background === b.background;

const sameEntry = (a: Entry | null, b: Entry | null): boolean =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.element === b.element &&
    a.position === b.position);

const sameOrder = (
  a: readonly DesignElement[],
  b: readonly DesignElement[]
): boolean =>
  a.length === b.length &&
  a.every((element, index) => element.id === b[index]?.id);

const entryOf = (editor: EditorDocument, element: DesignElement): Entry => ({
  element,
  position: editor.positions.get(element.id) ?? "",
});

// Builds the sorted document from page settings and element entries
export const composeDocument = (
  page: PageSettings,
  entries: Iterable<Entry>
): EditorDocument => {
  const sorted = [...entries]
    .map((entry) => ({ entry, id: entry.element.id, position: entry.position }))
    .toSorted(comparePositioned);
  return {
    document: {
      ...page,
      elements: sorted.map((item) => item.entry.element),
      version: DOCUMENT_VERSION,
    },
    positions: new Map(sorted.map((item) => [item.id, item.position])),
  };
};

// Turns a local edit (a new document from the array-based document ops) into
// a change set, giving new or moved elements fresh z-order keys
export const diffDocument = (
  current: EditorDocument,
  next: DesignDocument
): { changes: ChangeSet; editor: EditorDocument } => {
  const positions = sameOrder(current.document.elements, next.elements)
    ? current.positions
    : assignPositions(
        current.positions,
        next.elements.map((element) => element.id)
      );

  const remaining = new Map(
    current.document.elements.map((element) => [element.id, element])
  );
  const elements = new Map<string, Change<Entry | null>>();
  for (const element of next.elements) {
    const previous = remaining.get(element.id);
    remaining.delete(element.id);
    const before = previous ? entryOf(current, previous) : null;
    const after = { element, position: positions.get(element.id) ?? "" };
    if (!sameEntry(before, after)) {
      elements.set(element.id, { after, before });
    }
  }
  for (const [id, element] of remaining) {
    elements.set(id, { after: null, before: entryOf(current, element) });
  }

  const before = pageOf(current.document);
  const after = pageOf(next);
  const page = samePage(before, after) ? null : { after, before };

  return { changes: { elements, page }, editor: { document: next, positions } };
};

// Applies element states and page settings on top of a document
export const applyWrites = (
  current: EditorDocument,
  writes: Writes
): EditorDocument => {
  if (writes.elements.size === 0 && writes.page === null) {
    return current;
  }
  const entries = new Map(
    current.document.elements.map((element) => [
      element.id,
      entryOf(current, element),
    ])
  );
  for (const [id, entry] of writes.elements) {
    if (entry) {
      entries.set(id, entry);
    } else {
      entries.delete(id);
    }
  }
  return composeDocument(
    writes.page ?? pageOf(current.document),
    entries.values()
  );
};

// The states a change set leaves behind, i.e. what a local edit writes
export const writesOf = (changes: ChangeSet): Writes => ({
  elements: new Map(
    [...changes.elements].map(([id, change]) => [id, change.after])
  ),
  page: changes.page?.after ?? null,
});

const pick = <T>(change: Change<T>, direction: Direction): T =>
  direction === "undo" ? change.before : change.after;

const opposite = <T>(change: Change<T>, direction: Direction): T =>
  direction === "undo" ? change.after : change.before;

// What undoing or redoing a step writes. Only the elements that step touched
// are written, on top of whatever others changed since. An element someone
// else deleted meanwhile stays deleted, unless this step created or deleted
// it itself.
export const writesFor = (
  changes: ChangeSet,
  direction: Direction,
  current: EditorDocument
): Writes => {
  const exists = new Set(
    current.document.elements.map((element) => element.id)
  );
  const elements = new Map<string, Entry | null>();
  for (const [id, change] of changes.elements) {
    const target = pick(change, direction);
    const deletedByOthers =
      target !== null &&
      opposite(change, direction) !== null &&
      !exists.has(id);
    if (!deletedByOthers) {
      elements.set(id, target);
    }
  }
  return {
    elements,
    page: changes.page ? pick(changes.page, direction) : null,
  };
};

// Folds a later change set into an earlier one: the earliest "before" and the
// latest "after" per element. Elements back where they started drop out.
export const mergeChangeSets = (
  first: ChangeSet,
  second: ChangeSet
): ChangeSet => {
  const elements = new Map(first.elements);
  for (const [id, change] of second.elements) {
    const earlier = elements.get(id);
    const merged = earlier
      ? { after: change.after, before: earlier.before }
      : change;
    if (sameEntry(merged.before, merged.after)) {
      elements.delete(id);
    } else {
      elements.set(id, merged);
    }
  }

  let page = second.page ?? first.page;
  if (first.page && second.page) {
    page = { after: second.page.after, before: first.page.before };
  }
  if (page && samePage(page.before, page.after)) {
    page = null;
  }
  return { elements, page };
};
