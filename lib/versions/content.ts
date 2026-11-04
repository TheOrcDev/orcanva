import { comparePositioned } from "@/lib/collab/positions";
import { migrateDocument } from "@/lib/document/migrate";
import { sortPages } from "@/lib/document/pages";
import type { DesignDocument } from "@/lib/document/schema";
import type { VersionElement, VersionPage } from "@/lib/versions/schema";

// What GET /api/designs/[id]/versions/[versionId] sends: the version's
// size, pages and element rows, exactly as stored
export interface VersionContent {
  width: number;
  height: number;
  // The first page's (and, before pages, the only one's)
  background: unknown;
  docVersion: number;
  elements: VersionElement[];
  // In order; null for versions from before pages (one page)
  pages: VersionPage[] | null;
  // The images and photos in it
  assetIds: string[];
}

// One of a version's pages as a document to draw
export interface VersionPageDocument {
  // The page's id; null for the one page of a version from before pages
  id: string | null;
  document: DesignDocument;
  // Each element's z-order key, by element id
  positions: Record<string, string>;
}

export interface VersionDocument {
  // Every page, in order (always at least one)
  pages: VersionPageDocument[];
  // Rows this code can't read (usually an element type a newer Orcanva
  // added), left out of the pages
  skipped: string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// The version as documents to draw, page by page, each in z-order. Like the
// editor's live rows: rows that don't validate are left out and listed, and
// fields this code doesn't know are kept. An element on no page the version
// lists (or on none, from before pages) is on the first. Throws when the
// whole version is unreadable (a newer document version, a broken
// background).
export const versionDocument = (content: VersionContent): VersionDocument => {
  const sheets =
    content.pages && content.pages.length > 0
      ? sortPages(content.pages)
      : [{ background: content.background, id: null, position: "" }];
  const ids = new Set(sheets.map((sheet) => sheet.id));
  const firstId = sheets[0]?.id ?? null;
  const pageOf = (entry: VersionElement) =>
    entry.pageId !== null && ids.has(entry.pageId) ? entry.pageId : firstId;

  const sorted = content.elements.toSorted(comparePositioned);
  const matching = sorted.filter(
    (entry) => isRecord(entry.data) && entry.data.id === entry.id
  );
  const kept = new Set<string>();
  const pages = sheets.map((sheet) => {
    const entries = matching.filter((entry) => pageOf(entry) === sheet.id);
    const document = migrateDocument({
      background: sheet.background,
      elements: entries.map((entry) => entry.data),
      height: content.height,
      version: content.docVersion,
      width: content.width,
    });
    const shown = new Set(document.elements.map((element) => element.id));
    for (const id of shown) {
      kept.add(id);
    }
    return {
      document,
      id: sheet.id,
      positions: Object.fromEntries(
        entries
          .filter((entry) => shown.has(entry.id))
          .map((entry) => [entry.id, entry.position])
      ),
    };
  });
  return {
    pages,
    skipped: sorted
      .filter((entry) => !kept.has(entry.id))
      .map((entry) => entry.id),
  };
};
