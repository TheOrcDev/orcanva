"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireViewer } from "@/lib/auth/server";
import { getDb } from "@/lib/db/client";
import { visibleTo } from "@/lib/db/queries/designs";
import { designElements, designVisibility, designs } from "@/lib/db/schema";
import { createDocument } from "@/lib/document/factories";
import {
  DOCUMENT_VERSION,
  MAX_CANVAS_SIZE,
  MIN_CANVAS_SIZE,
} from "@/lib/document/schema";
import { thumbnailKey } from "@/lib/storage/keys";
import { copyObject, deleteObject } from "@/lib/storage/s3";

// Server Actions are public endpoints: each one checks the session itself
// Every page in the studio's sidebar layout (app/(studio)): a change to a
// design can move it between the galleries
const refreshStudio = () => revalidatePath("/(studio)", "layout");

const canvasSize = z.number().int().min(MIN_CANVAS_SIZE).max(MAX_CANVAS_SIZE);
const designName = z.string().trim().min(1).max(120);

const visibility = z.enum(designVisibility.enumValues);

const createDesignInput = z.object({
  height: canvasSize,
  name: designName,
  visibility,
  width: canvasSize,
});

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
  const [row] = await getDb()
    .insert(designs)
    .values({
      background: createDocument({ height, width }).background,
      height,
      name,
      ownerId: viewer.id,
      version: DOCUMENT_VERSION,
      visibility: chosen,
      width,
    })
    .returning({ id: designs.id });

  if (!row) {
    throw new Error("Could not create design");
  }
  refreshStudio();
  return { id: row.id };
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

export const deleteDesign = async (id: string): Promise<void> => {
  const designId = z.uuid().parse(id);
  const viewer = await requireViewer();
  const [row] = await getDb()
    .delete(designs)
    .where(and(eq(designs.id, designId), eq(designs.ownerId, viewer.id)))
    .returning({ thumbnailKey: designs.thumbnailKey });
  if (!row) {
    throw new Error("Design not found");
  }

  if (row.thumbnailKey) {
    await deleteObject(row.thumbnailKey);
  }
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

// "Make a copy": a full copy (elements + preview) of any design the viewer
// can open, owned by them, to rework without touching the original.
// Assets are shared, so no files are copied. Element ids only need to be
// unique within a design, so rows copy as-is.
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
    db.insert(designElements).select(
      db
        .select({
          data: designElements.data,
          designId: sql<string>`${copy.id}::uuid`.as("design_id"),
          id: designElements.id,
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
