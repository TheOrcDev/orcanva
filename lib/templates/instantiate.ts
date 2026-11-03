import { generateNKeysBetween } from "fractional-indexing";

import { createId } from "@/lib/document/factories";
import type { Size } from "@/lib/document/geometry";
import { migrateDocument } from "@/lib/document/migrate";
import type { DesignDocument, DesignElement } from "@/lib/document/schema";
import { resizeDocument } from "@/lib/editor/document-ops";
import { regroupCopies } from "@/lib/editor/groups";

// Copies of a template's elements with ids of their own, so the same
// template can go on a page twice; its groups become new groups
export const freshCopies = <T extends DesignElement>(elements: T[]): T[] =>
  regroupCopies(elements.map((element) => ({ ...element, id: createId() })));

// A template's design, ready to become a design or part of one: upgraded
// from whatever version its file was saved at, scaled to `size` when that
// differs, and with fresh element ids
export const instantiateTemplate = (
  raw: unknown,
  size?: Size
): DesignDocument => {
  const document = migrateDocument(raw);
  const sized = size ? resizeDocument(document, size, true) : document;
  return { ...sized, elements: freshCopies(sized.elements) };
};

// Z-order keys for a new design's element rows, bottom first
export const initialPositions = (count: number): string[] =>
  count > 0 ? generateNKeysBetween(null, null, count) : [];
