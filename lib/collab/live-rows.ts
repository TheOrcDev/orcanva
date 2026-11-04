import type { Entry, PageEntry } from "@/lib/collab/changeset";
import { isDeepEqual } from "@/lib/collab/equal";
import type { Size } from "@/lib/document/geometry";
import { resolvePageId } from "@/lib/document/pages";
import {
  DOCUMENT_VERSION,
  backgroundSchema,
  parseElement,
} from "@/lib/document/schema";
import type { Background } from "@/lib/document/schema";
import type {
  LiveElementRow,
  LivePageRow,
  LivePagesRow,
} from "@/lib/realtime/rows";

// Turns live element rows into entries. Rows whose content is unchanged
// keep their previous entry (no re-validation, same identity); rows that
// don't validate are skipped rather than breaking the whole design, and
// their ids are listed: usually a newer Orcanva wrote them (an element type
// this tab doesn't know), so a reload shows them. A row without a page
// (written by code from before pages) is on `firstPageId`.
export const entriesFromRows = (
  rows: readonly LiveElementRow[],
  previous: ReadonlyMap<string, Entry>,
  firstPageId: string
): { entries: Map<string, Entry>; skipped: string[] } => {
  const entries = new Map<string, Entry>();
  const skipped: string[] = [];
  for (const row of rows) {
    const pageId = resolvePageId(row.page_id, null, firstPageId);
    const known = previous.get(row.id);
    if (
      known &&
      known.position === row.position &&
      known.pageId === pageId &&
      isDeepEqual(known.element, row.data)
    ) {
      entries.set(row.id, known);
      continue;
    }
    const element = parseElement(row.data);
    if (element?.id === row.id) {
      entries.set(row.id, { element, pageId, position: row.position });
    } else {
      skipped.push(row.id);
    }
  }
  return { entries, skipped };
};

// Turns live page rows into pages, keeping unchanged ones as they were. A
// background this tab can't read (a kind a newer Orcanva added) shows as
// `fallback`, so the page and its elements still show.
export const pagesFromRows = (
  rows: readonly LivePagesRow[],
  previous: ReadonlyMap<string, PageEntry>,
  fallback: Background
): Map<string, PageEntry> => {
  const pages = new Map<string, PageEntry>();
  for (const row of rows) {
    const known = previous.get(row.id);
    if (
      known &&
      known.position === row.position &&
      isDeepEqual(known.background, row.background)
    ) {
      pages.set(row.id, known);
      continue;
    }
    const background = backgroundSchema.safeParse(row.background);
    pages.set(row.id, {
      background: background.success ? background.data : fallback,
      position: row.position,
    });
  }
  return pages;
};

// The design row: its size and name, and the background it holds for code
// from before pages (the first page's)
export const pageFromRow = (
  row: LivePageRow
): { size: Size; name: string; background: Background | null } => {
  const background = backgroundSchema.safeParse(row.background);
  return {
    background: background.success ? background.data : null,
    name: row.name,
    size: { height: row.height, width: row.width },
  };
};

// Newer code has written the design in a shape this tab doesn't know (the
// version goes up with such a change), so the tab must stop writing to it
export const isNewerDocument = (row: LivePageRow): boolean =>
  row.version > DOCUMENT_VERSION;

export interface RestoreMark {
  // designs.restore_seq
  seq: number;
  // Who restored last
  byName: string | null;
}

// Which restore the design is at, from the live page row; null when the
// row doesn't say (sealed before version history)
export const restoreFromRow = (row: LivePageRow): RestoreMark | null =>
  typeof row.restore_seq === "number" && Number.isInteger(row.restore_seq)
    ? {
        byName:
          typeof row.restored_by_name === "string"
            ? row.restored_by_name
            : null,
        seq: row.restore_seq,
      }
    : null;
