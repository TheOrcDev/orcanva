"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireViewer } from "@/lib/auth/server";
import { getDb } from "@/lib/db/client";
import { pagesOrLegacy, visibleTo } from "@/lib/db/queries/designs";
import {
  designElements,
  designPages,
  designVersions,
  designVisibility,
  designs,
} from "@/lib/db/schema";
import {
  canvasSize,
  designName,
  resizedCopyInput,
} from "@/lib/document/element-input";
import type { ResizedCopyInput } from "@/lib/document/element-input";
import { createDocument } from "@/lib/document/factories";
import {
  FIRST_PAGE_POSITION,
  documentVersionFor,
  firstPageIdOf,
  sortPages,
} from "@/lib/document/pages";
import { thumbnailKey } from "@/lib/storage/keys";
import { copyObject, deleteObject } from "@/lib/storage/s3";

// Server Actions are public endpoints: each one checks the session itself
// Every page in the studio's sidebar layout (app/(studio)): a change to a
// design can move it between the galleries
const refreshStudio = () => revalidatePath("/(studio)", "layout");

const visibility = z.enum(designVisibility.enumValues);

const createDesignInput = z.object({
  height: canvasSize,
  name: designName,
  visibility,
  width: canvasSize,
});

// A design and its one page, whose id is the design's own
export const createDesign = async (
  input: z.input<typeof createDesignInput>
): Promise<{ id: string }> => {
  const {
    height,
    name,
    visibility: chosen,
    width,
  } = createDesignInput.parse(input);
  const viewer = await requireViewer();
  const id = crypto.randomUUID();
  const { background } = createDocument({ height, width });
  const db = getDb();
  await db.batch([
    db.insert(designs).values({
      background,
      height,
      id,
      name,
      ownerId: viewer.id,
      version: documentVersionFor(1),
      visibility: chosen,
      width,
    }),
    db.insert(designPages).values({
      background,
      designId: id,
      id: firstPageIdOf(id),
      position: FIRST_PAGE_POSITION,
    }),
  ]);
  refreshStudio();
  return { id };
};

const renameDesignInput = z.object({ id: z.uuid(), name: designName });

export const renameDesign = async (
  input: z.input<typeof renameDesignInput>
): Promise<void> => {
  const { id, name } = renameDesignInput.parse(input);
  const viewer = await requireViewer();
  const [row] = await getDb()
    .update(designs)
    .set({ name, updatedAt: new Date() })
    .where(and(eq(designs.id, id), eq(designs.ownerId, viewer.id)))
    .returning({ id: designs.id });
  if (!row) {
    throw new Error("Design not found");
  }
  refreshStudio();
};

// Its versions go with it (the foreign key cascades), and so do their
// pictures. RETURNING runs before the cascade, so it still sees them.
export const deleteDesign = async (id: string): Promise<void> => {
  const designId = z.uuid().parse(id);
  const viewer = await requireViewer();
  const [row] = await getDb()
    .delete(designs)
    .where(and(eq(designs.id, designId), eq(designs.ownerId, viewer.id)))
    .returning({
      thumbnailKey: designs.thumbnailKey,
      versionKeys: sql<string[] | null>`(
        SELECT array_agg(${designVersions.thumbnailKey})
        FROM ${designVersions}
        WHERE ${designVersions.designId} = ${designs.id}
          AND ${designVersions.thumbnailKey} IS NOT NULL
      )`,
    });
  if (!row) {
    throw new Error("Design not found");
  }

  if (row.thumbnailKey) {
    await deleteObject(row.thumbnailKey);
  }
  await Promise.allSettled(
    (row.versionKeys ?? []).map((key) => deleteObject(key))
  );
  refreshStudio();
};

const visibilityInput = z.object({ id: z.uuid(), visibility });

// Owner only. Going private also moves the preview to a new random key, so
// a thumbnail URL someone saw while it was public stops working.
export const setDesignVisibility = async (
  input: z.input<typeof visibilityInput>
): Promise<void> => {
  const { id, visibility: next } = visibilityInput.parse(input);
  const viewer = await requireViewer();
  const db = getDb();
  const [row] = await db
    .update(designs)
    .set({ visibility: next })
    .where(and(eq(designs.id, id), eq(designs.ownerId, viewer.id)))
    .returning({ thumbnailKey: designs.thumbnailKey });
  if (!row) {
    throw new Error("Design not found");
  }

  if (next === "private" && row.thumbnailKey) {
    const key = thumbnailKey(id);
    try {
      await copyObject(row.thumbnailKey, key);
      await db
        .update(designs)
        .set({ thumbnailKey: key })
        .where(eq(designs.id, id));
      await deleteObject(row.thumbnailKey);
    } catch {
      // The next edit renders a preview under a fresh key anyway
    }
  }
  refreshStudio();
};

const COPY_SUFFIX = " copy";

// "Make a copy": a full copy (pages, elements, preview) of any design the
// viewer can open, owned by them, to rework without touching the original.
// Its version history stays with the original.
// Assets are shared, so no files are copied. Page and element ids only need
// to be unique within a design, so rows copy as-is; elements stored without
// a page (by code from before pages) go on the first.
export const duplicateDesign = async (id: string): Promise<{ id: string }> => {
  const sourceId = z.uuid().parse(id);
  const viewer = await requireViewer();
  const db = getDb();
  const [source] = await db
    .select()
    .from(designs)
    .where(and(eq(designs.id, sourceId), visibleTo(viewer.id)))
    .limit(1);
  if (!source) {
    throw new Error("Design not found");
  }

  const pages = pagesOrLegacy(
    source,
    await db
      .select({
        background: designPages.background,
        id: designPages.id,
        position: designPages.position,
      })
      .from(designPages)
      .where(eq(designPages.designId, sourceId))
  );
  const firstId = pages[0]?.id ?? firstPageIdOf(sourceId);

  const copy = { id: crypto.randomUUID() };
  const name = `${source.name.slice(0, 120 - COPY_SUFFIX.length)}${COPY_SUFFIX}`;
  await db.batch([
    db.insert(designs).values({
      background: source.background,
      height: source.height,
      id: copy.id,
      name,
      ownerId: viewer.id,
      version: source.version,
      // A copy starts out private; its owner can publish it
      visibility: "private",
      width: source.width,
    }),
    db.insert(designPages).values(
      pages.map((page) => ({
        background: page.background,
        designId: copy.id,
        id: page.id,
        position: page.position,
      }))
    ),
    db.insert(designElements).select(
      db
        .select({
          data: designElements.data,
          designId: sql<string>`${copy.id}::uuid`.as("design_id"),
          id: designElements.id,
          pageId:
            sql<string>`COALESCE(${designElements.pageId}, ${firstId})`.as(
              "page_id"
            ),
          position: designElements.position,
          updatedAt: designElements.updatedAt,
          updatedBy: sql<string | null>`null`.as("updated_by"),
        })
        .from(designElements)
        .where(eq(designElements.designId, sourceId))
    ),
  ]);

  if (source.thumbnailKey) {
    const key = thumbnailKey(copy.id);
    try {
      await copyObject(source.thumbnailKey, key);
      await db
        .update(designs)
        .set({ thumbnailKey: key })
        .where(eq(designs.id, copy.id));
    } catch {
      // The editor regenerates a preview on first open
    }
  }

  refreshStudio();
  return { id: copy.id };
};

// Magic Resize's copies: a new private design of the viewer's own, every
// page laid out by the browser (measuring text needs its fonts) from one
// they can open. The elements are checked as the changes route checks
// them, so this stores nothing a save couldn't. One batch, so a copy is
// never half made. It doesn't refresh the studio: from the editor that
// would load the whole design again, and the studio's pages are fetched
// afresh on the way back.
export const createResizedCopy = async (
  input: ResizedCopyInput
): Promise<{ id: string }> => {
  const { height, name, pages, sourceId, width } =
    resizedCopyInput.parse(input);
  const viewer = await requireViewer();
  const db = getDb();
  const [source] = await db
    .select({ id: designs.id })
    .from(designs)
    .where(and(eq(designs.id, sourceId), visibleTo(viewer.id)))
    .limit(1);
  if (!source) {
    throw new Error("Design not found");
  }

  const id = crypto.randomUUID();
  const [first] = sortPages(pages);
  const elements = pages.flatMap((page) =>
    page.elements.map(({ data, position }) => ({
      data,
      designId: id,
      id: data.id,
      pageId: page.id,
      position,
    }))
  );
  await db.batch([
    db.insert(designs).values({
      background: first?.background,
      height,
      id,
      name,
      ownerId: viewer.id,
      version: documentVersionFor(pages.length),
      visibility: "private",
      width,
    }),
    db.insert(designPages).values(
      pages.map((page) => ({
        background: page.background,
        designId: id,
        id: page.id,
        position: page.position,
      }))
    ),
    ...(elements.length > 0
      ? [db.insert(designElements).values(elements)]
      : []),
  ]);
  return { id };
};
