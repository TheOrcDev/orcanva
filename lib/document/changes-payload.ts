import { z } from "zod";

import {
  canvasSize,
  designName,
  elementData,
  positionKey,
} from "@/lib/document/element-input";
import {
  MAX_ELEMENTS,
  MAX_PAGES,
  backgroundSchema,
  pageIdSchema,
} from "@/lib/document/schema";
import type { Background, DesignElement } from "@/lib/document/schema";

// What POST /api/designs/[id]/changes accepts. Editors from before pages
// are still open after the deploy that adds them and keep sending their
// shape until they reload: no page on elements, and `page` (the size plus
// the background of the only page they know, the first).
export const changesPayload = z.object({
  clientId: z.uuid(),
  deletes: z.array(z.string().min(1).max(64)).max(MAX_ELEMENTS),
  elements: z
    .array(
      z.object({
        data: elementData,
        mode: z.enum(["create", "update"]),
        // Missing from tabs from before pages
        pageId: pageIdSchema.optional(),
        position: positionKey,
      })
    )
    .max(MAX_ELEMENTS),
  name: designName.optional(),
  // Tabs from before pages: the size and the first page's background
  page: z
    .object({
      background: backgroundSchema,
      height: canvasSize,
      width: canvasSize,
    })
    .optional(),
  // A page created and deleted again before a batch went out is still sent
  // as a delete, so there can be more of these than pages
  pageDeletes: z
    .array(pageIdSchema)
    .max(MAX_PAGES * 4)
    .optional(),
  pages: z
    .array(
      z.object({
        background: backgroundSchema,
        id: pageIdSchema,
        // "create" upserts; "update" only touches a page that still exists
        mode: z.enum(["create", "update"]),
        position: positionKey,
      })
    )
    .max(MAX_PAGES * 2)
    .refine(
      (pages) => new Set(pages.map((page) => page.id)).size === pages.length,
      { message: "Page ids must be unique" }
    )
    .optional(),
  size: z.object({ height: canvasSize, width: canvasSize }).optional(),
});

export type ChangesPayload = z.output<typeof changesPayload>;

export interface ElementWriteInput {
  data: DesignElement;
  mode: "create" | "update";
  position: string;
  // null: wherever the row is, or the first page for a new one
  pageId: string | null;
}

export interface PageWriteInput {
  id: string;
  mode: "create" | "update";
  position: string;
  background: Background;
}

// One batch as the save statement takes it
export interface ChangesWrites {
  writes: ElementWriteInput[];
  deletes: string[];
  pages: PageWriteInput[];
  pageDeletes: string[];
  size: { width: number; height: number } | null;
  // From a tab from before pages: the background of the first page
  firstPageBackground: Background | null;
  name: string | null;
}

// Maps both shapes onto one: an old tab's `page` becomes the design's size
// and its first page's background
export const changesWritesOf = (payload: ChangesPayload): ChangesWrites => ({
  deletes: payload.deletes,
  firstPageBackground: payload.page?.background ?? null,
  name: payload.name ?? null,
  pageDeletes: payload.pageDeletes ?? [],
  pages: payload.pages ?? [],
  size:
    payload.size ??
    (payload.page
      ? { height: payload.page.height, width: payload.page.width }
      : null),
  writes: payload.elements.map(({ data, mode, pageId, position }) => ({
    data,
    mode,
    pageId: pageId ?? null,
    position,
  })),
});
