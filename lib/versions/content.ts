import { comparePositioned } from "@/lib/collab/positions";
import { migrateDocument } from "@/lib/document/migrate";
import type { DesignDocument } from "@/lib/document/schema";
import type { VersionElement } from "@/lib/versions/schema";

// What GET /api/designs/[id]/versions/[versionId] sends: the version's page
// and its element rows, exactly as stored
export interface VersionContent {
  width: number;
  height: number;
  background: unknown;
  docVersion: number;
  elements: VersionElement[];
  // The images and photos in it
  assetIds: string[];
}

export interface VersionDocument {
  document: DesignDocument;
  // Each element's z-order key, by element id
  positions: Record<string, string>;
  // Rows this code can't read (usually an element type a newer Orcanva
  // added), left out of the document
  skipped: string[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// The version as a document to draw, in z-order. Like the editor's live
// rows: rows that don't validate are left out and listed, and fields this
// code doesn't know are kept. Throws when the whole version is unreadable
// (a newer document version, a broken background).
export const versionDocument = (content: VersionContent): VersionDocument => {
  const sorted = content.elements.toSorted(comparePositioned);
  const matching = sorted.filter(
    (entry) => isRecord(entry.data) && entry.data.id === entry.id
  );
  const document = migrateDocument({
    background: content.background,
    elements: matching.map((entry) => entry.data),
    height: content.height,
    version: content.docVersion,
    width: content.width,
  });
  const kept = new Set(document.elements.map((element) => element.id));
  return {
    document,
    positions: Object.fromEntries(
      matching
        .filter((entry) => kept.has(entry.id))
        .map((entry) => [entry.id, entry.position])
    ),
    skipped: sorted
      .filter((entry) => !kept.has(entry.id))
      .map((entry) => entry.id),
  };
};
