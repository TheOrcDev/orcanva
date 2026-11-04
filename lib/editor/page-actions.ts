import { diffDocument } from "@/lib/collab/changeset";
import type {
  Change,
  ChangeSet,
  Entry,
  PageEntry,
  PageView,
} from "@/lib/collab/changeset";
import { assignPositions } from "@/lib/collab/positions";
import type { Size } from "@/lib/document/geometry";
import type { Background, DesignDocument } from "@/lib/document/schema";
import { regroupCopies } from "@/lib/editor/groups";

// The page actions of the page strip, each one change set (one undo step).
// They take the pages as the editor shows them, in order.

const entryOf = (page: PageView): PageEntry => ({
  background: page.doc.document.background,
  position: page.position,
});

// New z-order keys for the pages in `order` (ids), rewriting as few as
// possible: the pages that move or are new. Updates for the existing pages
// whose key changed go into `changes`.
const reorder = (
  pages: readonly PageView[],
  order: readonly string[],
  changes: Map<string, Change<PageEntry | null>>
): Map<string, string> => {
  const positions = assignPositions(
    new Map(pages.map((page) => [page.id, page.position])),
    order
  );
  for (const page of pages) {
    const position = positions.get(page.id);
    if (position !== undefined && position !== page.position) {
      changes.set(page.id, {
        after: { ...entryOf(page), position },
        before: entryOf(page),
      });
    }
  }
  return new Map(positions);
};

const idsWith = (
  pages: readonly PageView[],
  id: string,
  index: number
): string[] => {
  const ids = pages.map((page) => page.id).filter((pageId) => pageId !== id);
  ids.splice(Math.max(0, Math.min(index, ids.length)), 0, id);
  return ids;
};

// A blank page right after `afterId`
export const addPageChanges = (
  pages: readonly PageView[],
  afterId: string,
  id: string,
  background: Background
): ChangeSet => {
  const changes = new Map<string, Change<PageEntry | null>>();
  const index = pages.findIndex((page) => page.id === afterId);
  const positions = reorder(pages, idsWith(pages, id, index + 1), changes);
  changes.set(id, {
    after: { background, position: positions.get(id) ?? "" },
    before: null,
  });
  return { elements: new Map(), pages: changes, size: null };
};

// A copy of a page right after it: its background, and its elements with
// ids of their own (their groups become new groups) and the same z-order
// keys. `newId` makes each id. Null when there's no such page.
export const duplicatePageChanges = (
  pages: readonly PageView[],
  sourceId: string,
  id: string,
  newId: () => string
): ChangeSet | null => {
  const index = pages.findIndex((page) => page.id === sourceId);
  const source = pages[index];
  if (!source) {
    return null;
  }
  const changes = new Map<string, Change<PageEntry | null>>();
  const positions = reorder(pages, idsWith(pages, id, index + 1), changes);
  changes.set(id, {
    after: {
      background: source.doc.document.background,
      position: positions.get(id) ?? "",
    },
    before: null,
  });

  const { elements } = source.doc.document;
  const copies = regroupCopies(
    elements.map((element) => ({ ...element, id: newId() }))
  );
  const created = new Map<string, Change<Entry | null>>();
  for (const [order, copy] of copies.entries()) {
    const original = elements[order];
    created.set(copy.id, {
      after: {
        element: copy,
        pageId: id,
        position: (original && source.doc.positions.get(original.id)) ?? "",
      },
      before: null,
    });
  }
  return { elements: created, pages: changes, size: null };
};

// Deletes a page and every element on it, each written out so undo brings
// them all back. Null for the last page, which stays, or one that's gone.
export const deletePageChanges = (
  pages: readonly PageView[],
  id: string
): ChangeSet | null => {
  const page = pages.find((item) => item.id === id);
  if (!page || pages.length < 2) {
    return null;
  }
  const elements = new Map<string, Change<Entry | null>>(
    page.doc.document.elements.map((element) => [
      element.id,
      {
        after: null,
        before: {
          element,
          pageId: id,
          position: page.doc.positions.get(element.id) ?? "",
        },
      },
    ])
  );
  return {
    elements,
    pages: new Map([[id, { after: null, before: entryOf(page) }]]),
    size: null,
  };
};

// Moves a page to `index` among the pages; null when it's already there
export const movePageChanges = (
  pages: readonly PageView[],
  id: string,
  index: number
): ChangeSet | null => {
  const from = pages.findIndex((page) => page.id === id);
  if (from === -1 || from === index) {
    return null;
  }
  const changes = new Map<string, Change<PageEntry | null>>();
  reorder(pages, idsWith(pages, id, index), changes);
  return changes.size > 0
    ? { elements: new Map(), pages: changes, size: null }
    : null;
};

// The page shown after `id` is deleted: the one after it, else the one
// before
export const neighbourOf = (
  pages: readonly PageView[],
  id: string
): string | undefined => {
  const index = pages.findIndex((page) => page.id === id);
  return (pages[index + 1] ?? pages[index - 1])?.id;
};

// One change to every page, such as a resize or a page crop: `recipe`
// changes each page's document and they share the new size. One change set,
// so one undo step.
export const allPagesChanges = (
  pages: readonly PageView[],
  recipe: (document: DesignDocument) => DesignDocument
): ChangeSet => {
  const elements = new Map<string, Change<Entry | null>>();
  const pageChanges = new Map<string, Change<PageEntry | null>>();
  let size: Change<Size> | null = null;
  for (const page of pages) {
    const next = recipe(page.doc.document);
    if (next !== page.doc.document) {
      const { changes } = diffDocument(page.doc, next, page);
      for (const [id, change] of changes.elements) {
        elements.set(id, change);
      }
      for (const [id, change] of changes.pages) {
        pageChanges.set(id, change);
      }
      size ??= changes.size;
    }
  }
  return { elements, pages: pageChanges, size };
};
