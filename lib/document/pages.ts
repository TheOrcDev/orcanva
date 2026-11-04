import { comparePositioned } from "@/lib/collab/positions";
import type { Background } from "@/lib/document/schema";

// A design's pages. Every page has the design's size and its own background
// and elements; `position` is a fractional index, as for elements, so pages
// sort (and reorder) the same way.
export interface DesignPage {
  id: string;
  position: string;
  background: Background;
}

// The z-order key of a design's first page when it's made, and of the page
// every design got when pages arrived
export const FIRST_PAGE_POSITION = "a0";

// A new page's background, and what a page without one shows
export const WHITE_PAGE_BACKGROUND: Background = {
  color: "#ffffff",
  type: "solid",
};

// The document version that brought pages: a design with more than one
// page, or that had more at some point, has at least this version, so
// editors from before pages stop writing to it (they'd show and save only
// its first page). A design with one page keeps version 1, which code from
// before pages reads and edits as it always did.
export const PAGES_VERSION = 2;

// The version a new design is stored with
export const documentVersionFor = (pageCount: number): number =>
  pageCount > 1 ? PAGES_VERSION : 1;

// A design's first page has the design's own id. Rows written by code from
// before pages (elements and presence without a page, versions without
// pages, comments without one) are on the first page.
export const firstPageIdOf = (designId: string): string => designId;

// The page an element write lands on: the one it names, else the one its
// row is already on, else the design's first page. Tabs from before pages
// name none, so their new elements land on the first page and their edits
// leave elements where they are. The save statement does the same in SQL.
export const resolvePageId = (
  given: string | null | undefined,
  current: string | null | undefined,
  firstPageId: string
): string => given ?? current ?? firstPageId;

// Pages in their order
export const sortPages = <Page extends { id: string; position: string }>(
  pages: Iterable<Page>
): Page[] => [...pages].toSorted(comparePositioned);
