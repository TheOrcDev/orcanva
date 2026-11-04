import "server-only";
import { sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";

import { FIRST_PAGE_POSITION } from "@/lib/document/pages";

// What a design without a stored background shows (see migrateDocument)
export const WHITE_BACKGROUND = JSON.stringify({
  color: "#ffffff",
  type: "solid",
});

// Page order in SQL: code-unit order of the fractional keys, then the id,
// as comparePositioned sorts them in the browser
export const PAGE_ORDER = sql.raw(`position COLLATE "C", id COLLATE "C"`);

// A design's pages (id, position, background) as a statement sees them:
// its rows in design_pages, or, for a design that has none (code from
// before pages made it), its one page: the design's own id with the
// background the design row holds. `designId` is SQL naming the design's
// id (a column or a parameter), compared as uuid.
export const pagesOf = (designId: SQL): SQL => sql`(
  SELECT id, position, background
  FROM design_pages WHERE design_pages.design_id = ${designId}
  UNION ALL
  SELECT designs.id::text, ${FIRST_PAGE_POSITION}::text,
    COALESCE(designs.background, ${WHITE_BACKGROUND}::jsonb)
  FROM designs
  WHERE designs.id = ${designId}
    AND NOT EXISTS (
      SELECT 1 FROM design_pages WHERE design_pages.design_id = ${designId}
    )
)`;
