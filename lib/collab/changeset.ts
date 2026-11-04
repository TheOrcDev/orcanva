import { isDeepEqual } from "@/lib/collab/equal";
import { assignPositions, comparePositioned } from "@/lib/collab/positions";
import type { Positions } from "@/lib/collab/positions";
import type { Size } from "@/lib/document/geometry";
import { sortPages } from "@/lib/document/pages";
import { DOCUMENT_VERSION } from "@/lib/document/schema";
import type {
  Background,
  DesignDocument,
  DesignElement,
} from "@/lib/document/schema";

// An element as stored: its data, its z-order key and the page it's on
export interface Entry {
  element: DesignElement;
  position: string;
  pageId: string;
}

// A page as stored: its place among the pages and its background. Every
// page has the design's size.
export interface PageEntry {
  position: string;
  background: Background;
}

// The whole design, flat: its size, its pages and every element on them
export interface DesignContent {
  size: Size;
  pages: ReadonlyMap<string, PageEntry>;
  elements: ReadonlyMap<string, Entry>;
}

// One page rendered as a document (the design's size, the page's
// background and elements) plus every element's z-order key. The elements
// array is always sorted by those keys.
export interface EditorDocument {
  document: DesignDocument;
  positions: Positions;
}

// A page as the editor shows it
export interface PageView {
  id: string;
  position: string;
  doc: EditorDocument;
}

export interface Change<T> {
  before: T;
  after: T;
}

// What one edit (or one undo step) did, element by element and page by
// page. null means "didn't exist": a null before is a create, a null after
// a delete. `size` is the design's, shared by every page.
export interface ChangeSet {
  elements: ReadonlyMap<string, Change<Entry | null>>;
  pages: ReadonlyMap<string, Change<PageEntry | null>>;
  size: Change<Size> | null;
}

// The states to write: each touched element and page (null = delete) and
// the size
export interface Writes {
  elements: ReadonlyMap<string, Entry | null>;
  pages: ReadonlyMap<string, PageEntry | null>;
  size: Size | null;
}

export type Direction = "undo" | "redo";

export const EMPTY_CHANGES: ChangeSet = {
  elements: new Map(),
  pages: new Map(),
  size: null,
};

export const isEmptyChangeSet = (changes: ChangeSet): boolean =>
  changes.elements.size === 0 &&
  changes.pages.size === 0 &&
  changes.size === null;

const isEmptyWrites = (writes: Writes): boolean =>
  writes.elements.size === 0 && writes.pages.size === 0 && writes.size === null;

export const sizeOf = (document: Size): Size => ({
  height: document.height,
  width: document.width,
});

const sameSize = (a: Size, b: Size): boolean =>
  a.width === b.width && a.height === b.height;

const samePage = (a: PageEntry | null, b: PageEntry | null): boolean =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.position === b.position &&
    a.background === b.background);

const sameEntry = (a: Entry | null, b: Entry | null): boolean =>
  a === b ||
  (a !== null &&
    b !== null &&
    a.element === b.element &&
    a.position === b.position &&
    a.pageId === b.pageId);

const sameOrder = (
  a: readonly DesignElement[],
  b: readonly DesignElement[]
): boolean =>
  a.length === b.length &&
  a.every((element, index) => element.id === b[index]?.id);

// Builds a page's sorted document from its settings and element entries
export const composeDocument = (
  page: Size & { background: Background },
  entries: Iterable<Pick<Entry, "element" | "position">>
): EditorDocument => {
  const sorted = [...entries]
    .map((entry) => ({ entry, id: entry.element.id, position: entry.position }))
    .toSorted(comparePositioned);
  return {
    document: {
      background: page.background,
      elements: sorted.map((item) => item.entry.element),
      height: page.height,
      version: DOCUMENT_VERSION,
      width: page.width,
    },
    positions: new Map(sorted.map((item) => [item.id, item.position])),
  };
};

// The design behind its pages, flat
export const contentOf = (pages: readonly PageView[]): DesignContent => {
  const first = pages[0]?.doc.document;
  const elements = new Map<string, Entry>();
  for (const page of pages) {
    for (const element of page.doc.document.elements) {
      elements.set(element.id, {
        element,
        pageId: page.id,
        position: page.doc.positions.get(element.id) ?? "",
      });
    }
  }
  return {
    elements,
    pages: new Map(
      pages.map((page) => [
        page.id,
        { background: page.doc.document.background, position: page.position },
      ])
    ),
    size: { height: first?.height ?? 0, width: first?.width ?? 0 },
  };
};

const unchangedDoc = (current: EditorDocument, next: EditorDocument): boolean =>
  next.document.width === current.document.width &&
  next.document.height === current.document.height &&
  next.document.background === current.document.background &&
  next.document.elements.length === current.document.elements.length &&
  next.document.elements.every(
    (element, index) =>
      element === current.document.elements[index] &&
      next.positions.get(element.id) === current.positions.get(element.id)
  );

// The design's pages in order, each a document of its own. Elements on a
// page that isn't there (its delete arrived first) aren't shown. A page
// whose content didn't change keeps its object, so only what really
// changed re-renders; `reuse` may swap an element for an equal one shown
// before.
export const composePages = (
  content: DesignContent,
  previous: readonly PageView[],
  reuse: (element: DesignElement) => DesignElement = (element) => element
): PageView[] => {
  const byPage = new Map<string, Pick<Entry, "element" | "position">[]>();
  for (const id of content.pages.keys()) {
    byPage.set(id, []);
  }
  for (const entry of content.elements.values()) {
    byPage
      .get(entry.pageId)
      ?.push({ element: reuse(entry.element), position: entry.position });
  }
  const shown = new Map(previous.map((page) => [page.id, page]));
  const pages = sortPages(
    [...content.pages].map(([id, page]) => ({ ...page, id }))
  ).map((page): PageView => {
    const before = shown.get(page.id);
    const doc = composeDocument(
      {
        background:
          before && isDeepEqual(before.doc.document.background, page.background)
            ? before.doc.document.background
            : page.background,
        ...content.size,
      },
      byPage.get(page.id) ?? []
    );
    if (before && before.position === page.position) {
      return unchangedDoc(before.doc, doc) ? before : { ...before, doc };
    }
    return { doc, id: page.id, position: page.position };
  });
  const same =
    pages.length === previous.length &&
    pages.every((page, index) => page === previous[index]);
  return same ? (previous as PageView[]) : pages;
};

const entryOf = (
  editor: EditorDocument,
  element: DesignElement,
  pageId: string
): Entry => ({
  element,
  pageId,
  position: editor.positions.get(element.id) ?? "",
});

// Turns a local edit of one page (a new document from the array-based
// document ops) into a change set, giving new or moved elements fresh
// z-order keys on that page. A new background is a change to the page; a
// new width or height is the design's size, every page's.
export const diffDocument = (
  current: EditorDocument,
  next: DesignDocument,
  page: { id: string; position: string }
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
    const before = previous ? entryOf(current, previous, page.id) : null;
    const after = {
      element,
      pageId: page.id,
      position: positions.get(element.id) ?? "",
    };
    if (!sameEntry(before, after)) {
      elements.set(element.id, { after, before });
    }
  }
  for (const [id, element] of remaining) {
    elements.set(id, {
      after: null,
      before: entryOf(current, element, page.id),
    });
  }

  const pages = new Map<string, Change<PageEntry | null>>();
  if (next.background !== current.document.background) {
    pages.set(page.id, {
      after: { background: next.background, position: page.position },
      before: {
        background: current.document.background,
        position: page.position,
      },
    });
  }
  const before = sizeOf(current.document);
  const after = sizeOf(next);
  const size = sameSize(before, after) ? null : { after, before };

  return {
    changes: { elements, pages, size },
    editor: { document: next, positions },
  };
};

// Applies element, page and size states on top of the design
export const applyWrites = (
  current: DesignContent,
  writes: Writes
): DesignContent => {
  if (isEmptyWrites(writes)) {
    return current;
  }
  const elements = new Map(current.elements);
  for (const [id, entry] of writes.elements) {
    if (entry) {
      elements.set(id, entry);
    } else {
      elements.delete(id);
    }
  }
  const pages = new Map(current.pages);
  for (const [id, page] of writes.pages) {
    if (page) {
      pages.set(id, page);
    } else {
      pages.delete(id);
    }
  }
  return { elements, pages, size: writes.size ?? current.size };
};

// The states a change set leaves behind, i.e. what a local edit writes
export const writesOf = (changes: ChangeSet): Writes => ({
  elements: new Map(
    [...changes.elements].map(([id, change]) => [id, change.after])
  ),
  pages: new Map([...changes.pages].map(([id, change]) => [id, change.after])),
  size: changes.size?.after ?? null,
});

const pick = <T>(change: Change<T>, direction: Direction): T =>
  direction === "undo" ? change.before : change.after;

const opposite = <T>(change: Change<T>, direction: Direction): T =>
  direction === "undo" ? change.after : change.before;

// What undoing or redoing a step writes. Only the elements and pages that
// step touched are written, on top of whatever others changed since. An
// element or page someone else deleted meanwhile stays deleted, unless this
// step created or deleted it itself, and an element isn't brought back onto
// a page that's gone.
export const writesFor = (
  changes: ChangeSet,
  direction: Direction,
  current: DesignContent
): Writes => {
  const pages = new Map<string, PageEntry | null>();
  const livePages = new Set(current.pages.keys());
  for (const [id, change] of changes.pages) {
    const target = pick(change, direction);
    const deletedByOthers =
      target !== null &&
      opposite(change, direction) !== null &&
      !current.pages.has(id);
    if (!deletedByOthers) {
      pages.set(id, target);
      if (target) {
        livePages.add(id);
      } else {
        livePages.delete(id);
      }
    }
  }

  const elements = new Map<string, Entry | null>();
  for (const [id, change] of changes.elements) {
    const target = pick(change, direction);
    const deletedByOthers =
      target !== null &&
      opposite(change, direction) !== null &&
      !current.elements.has(id);
    const pageGone = target !== null && !livePages.has(target.pageId);
    if (!(deletedByOthers || pageGone)) {
      elements.set(id, target);
    }
  }
  return {
    elements,
    pages,
    size: changes.size ? pick(changes.size, direction) : null,
  };
};

// The pages a step changes when undone or redone, in the order it lists
// them: the pages of its elements and the pages it creates or updates
export const pagesOfStep = (
  changes: ChangeSet,
  direction: Direction
): string[] => {
  const ids = new Set<string>();
  for (const change of changes.elements.values()) {
    const entry = pick(change, direction) ?? opposite(change, direction);
    if (entry) {
      ids.add(entry.pageId);
    }
  }
  for (const [id, change] of changes.pages) {
    if (pick(change, direction)) {
      ids.add(id);
    }
  }
  return [...ids];
};

// Folds a later change set into an earlier one: the earliest "before" and
// the latest "after" per element and page. Those back where they started
// drop out.
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

  const pages = new Map(first.pages);
  for (const [id, change] of second.pages) {
    const earlier = pages.get(id);
    const merged = earlier
      ? { after: change.after, before: earlier.before }
      : change;
    if (samePage(merged.before, merged.after)) {
      pages.delete(id);
    } else {
      pages.set(id, merged);
    }
  }

  let size = second.size ?? first.size;
  if (first.size && second.size) {
    size = { after: second.size.after, before: first.size.before };
  }
  if (size && sameSize(size.before, size.after)) {
    size = null;
  }
  return { elements, pages, size };
};
