"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getDb } from "@/lib/db/client";
import { designElements, designs } from "@/lib/db/schema";
import { createDocument } from "@/lib/document/factories";
import {
  DOCUMENT_VERSION,
  MAX_CANVAS_SIZE,
  MIN_CANVAS_SIZE,
} from "@/lib/document/schema";
import { thumbnailKey } from "@/lib/storage/keys";
import { copyObject, deleteObject } from "@/lib/storage/s3";

const canvasSize = z.number().int().min(MIN_CANVAS_SIZE).max(MAX_CANVAS_SIZE);
const designName = z.string().trim().min(1).max(120);

const createDesignInput = z.object({
  height: canvasSize,
  name: designName,
  width: canvasSize,
});

export const createDesign = async (
  input: z.input<typeof createDesignInput>
): Promise<{ id: string }> => {
  const { height, name, width } = createDesignInput.parse(input);
  const [row] = await getDb()
    .insert(designs)
    .values({
      background: createDocument({ height, width }).background,
      height,
      name,
      version: DOCUMENT_VERSION,
      width,
    })
    .returning({ id: designs.id });

  if (!row) {
    throw new Error("Could not create design");
  }
  revalidatePath("/");
  return { id: row.id };
};

const renameDesignInput = z.object({ id: z.uuid(), name: designName });

export const renameDesign = async (
  input: z.input<typeof renameDesignInput>
): Promise<void> => {
  const { id, name } = renameDesignInput.parse(input);
  await getDb()
    .update(designs)
    .set({ name, updatedAt: new Date() })
    .where(eq(designs.id, id));
  revalidatePath("/");
};

export const deleteDesign = async (id: string): Promise<void> => {
  const designId = z.uuid().parse(id);
  const [row] = await getDb()
    .delete(designs)
    .where(eq(designs.id, designId))
    .returning({ thumbnailKey: designs.thumbnailKey });

  if (row?.thumbnailKey) {
    await deleteObject(row.thumbnailKey);
  }
  revalidatePath("/");
};

const COPY_SUFFIX = " copy";

// "Use as template": a full copy (elements + preview) the user can rework
// without touching the original. Assets are shared, so no files are copied.
// Element ids only need to be unique within a design, so rows copy as-is.
export const duplicateDesign = async (id: string): Promise<{ id: string }> => {
  const sourceId = z.uuid().parse(id);
  const db = getDb();
  const [source] = await db
    .select()
    .from(designs)
    .where(eq(designs.id, sourceId))
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
      version: source.version,
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
    const key = thumbnailKey(copy.id, Date.now());
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

  revalidatePath("/");
  return { id: copy.id };
};
