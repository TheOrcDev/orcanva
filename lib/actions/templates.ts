"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getDesignAccess } from "@/lib/auth/design-access";
import { ownerOfNewDesign } from "@/lib/auth/new-design";
import { upsertTemplateAssets } from "@/lib/db/queries/assets";
import { insertNewDesign } from "@/lib/db/queries/new-design";
import { designVisibility } from "@/lib/db/schema";
import { migrateDocument } from "@/lib/document/migrate";
import { findPresetById } from "@/lib/document/presets";
import type { DesignDocument } from "@/lib/document/schema";
import type { EditorAsset } from "@/lib/editor/store";
import { templateAssetRow, templateEditorAsset } from "@/lib/templates/assets";
import { instantiateTemplate } from "@/lib/templates/instantiate";
import { readTemplate } from "@/lib/templates/read";
import { templateIdSchema } from "@/lib/templates/schema";

// Server Actions are public endpoints: each one checks the session itself

const createInput = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  templateId: templateIdSchema,
  visibility: z.enum(designVisibility.enumValues).default("private"),
});

// A new design of the viewer's own, made from a template at its size; a
// guest's is public and nobody's (ownerOfNewDesign)
export const createDesignFromTemplate = async (
  input: z.input<typeof createInput>
): Promise<{ id: string }> => {
  const { name, templateId, visibility } = createInput.parse(input);
  const template = await readTemplate(templateId);
  const ownerId = await ownerOfNewDesign(visibility);
  const preset = findPresetById(template.presetId);
  if (!preset) {
    throw new Error("Template not found");
  }
  const id = crypto.randomUUID();
  // Templates are one page, so the design is too
  await insertNewDesign({
    assetRows: template.assets.map(templateAssetRow),
    document: instantiateTemplate(template.document, preset),
    id,
    name: name ?? template.name,
    ownerId,
    visibility,
  });

  // Every page in the studio's sidebar layout, as for a blank design
  revalidatePath("/(studio)", "layout");
  return { id };
};

const loadInput = z.object({
  designId: z.uuid(),
  templateId: templateIdSchema,
});

// A template's document and images for the editor's Templates tab, which
// puts it on the page itself. Its images' rows are written here, since the
// page's photos will point at them, so only someone who may edit the design
// (guests too, on a public one) gets that far.
export const loadTemplate = async (
  input: z.input<typeof loadInput>
): Promise<{ assets: EditorAsset[]; document: DesignDocument }> => {
  const { designId, templateId } = loadInput.parse(input);
  const { role } = await getDesignAccess(designId);
  if (!role) {
    throw new Error("Design not found");
  }
  const template = await readTemplate(templateId);
  await upsertTemplateAssets(template.assets);
  return {
    assets: template.assets.map(templateEditorAsset),
    document: migrateDocument(template.document),
  };
};
