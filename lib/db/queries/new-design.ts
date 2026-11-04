import "server-only";
import type { Visibility } from "@/lib/auth/access";
import { getDb } from "@/lib/db/client";
import { assets, designElements, designPages, designs } from "@/lib/db/schema";
import {
  FIRST_PAGE_POSITION,
  documentVersionFor,
  firstPageIdOf,
} from "@/lib/document/pages";
import type { DesignDocument } from "@/lib/document/schema";
import { initialPositions } from "@/lib/templates/instantiate";

// A new design in one batch: its row, its one page (whose id is the
// design's own), the page's elements bottom to top, and rows for the
// template images its photos point at. "New design", "Start from" a
// template and the MCP server all make designs through this.
export const insertNewDesign = async ({
  assetRows = [],
  document,
  id,
  name,
  ownerId,
  visibility,
}: {
  assetRows?: (typeof assets.$inferInsert)[];
  document: DesignDocument;
  id: string;
  name: string;
  ownerId: string | null;
  visibility: Visibility;
}): Promise<void> => {
  const pageId = firstPageIdOf(id);
  const positions = initialPositions(document.elements.length);
  const db = getDb();
  await db.batch([
    db.insert(designs).values({
      background: document.background,
      height: document.height,
      id,
      name,
      ownerId,
      version: documentVersionFor(1),
      visibility,
      width: document.width,
    }),
    db.insert(designPages).values({
      background: document.background,
      designId: id,
      id: pageId,
      position: FIRST_PAGE_POSITION,
    }),
    ...(assetRows.length > 0
      ? [db.insert(assets).values(assetRows).onConflictDoNothing()]
      : []),
    ...(document.elements.length > 0
      ? [
          db.insert(designElements).values(
            document.elements.map((element, index) => ({
              data: element,
              designId: id,
              id: element.id,
              pageId,
              position: positions[index] ?? "",
            }))
          ),
        ]
      : []),
  ]);
};
