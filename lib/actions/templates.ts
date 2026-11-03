"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { getDesignAccess } from "@/lib/auth/design-access";
import { requireViewer } from "@/lib/auth/server";
import { getDb } from "@/lib/db/client";
import { upsertTemplateAssets } from "@/lib/db/queries/assets";
import {
  assets,
  designElements,
  designVisibility,
  designs,
} from "@/lib/db/schema";
import { migrateDocument } from "@/lib/document/migrate";
import { findPresetById } from "@/lib/document/presets";
import { DOCUMENT_VERSION } from "@/lib/document/schema";
import type { DesignDocument } from "@/lib/document/schema";
import type { EditorAsset } from "@/lib/editor/store";
import { templateAssetRow, templateEditorAsset } from "@/lib/templates/assets";
import { TEMPLATE_FILES } from "@/lib/templates/documents";
import {
  initialPositions,
  instantiateTemplate,
} from "@/lib/templates/instantiate";
import { templateIdSchema, templateSchema } from "@/lib/templates/schema";
import type { Template } from "@/lib/templates/schema";

// Server Actions are public endpoints: each one checks the session itself

const readTemplate = async (id: string): Promise<Template> => {
  const load = Object.hasOwn(TEMPLATE_FILES, id) ? TEMPLATE_FILES[id] : null;
  if (!load) {
    throw new Error("Template not found");
  }
  return templateSchema.parse(await load());
};

const createInput = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  templateId: templateIdSchema,
  visibility: z.enum(designVisibility.enumValues).default("private"),
});

// A new design of the viewer's own, made from a template at its size
export const createDesignFromTemplate = async (
  input: z.input<typeof createInput>
): Promise<{ id: string }> => {
  const { name, templateId, visibility } = createInput.parse(input);
  const viewer = await requireViewer();
  const template = await readTemplate(templateId);
  const preset = findPresetById(template.presetId);
  if (!preset) {
    throw new Error("Template not found");
  }
  const document = instantiateTemplate(template.document, preset);
  const positions = initialPositions(document.elements.length);

  const id = crypto.randomUUID();
  const db = getDb();
  const design = db.insert(designs).values({
    background: document.background,
    height: document.height,
    id,
    name: name ?? template.name,
    ownerId: viewer.id,
    version: DOCUMENT_VERSION,
    visibility,
    width: document.width,
  });
  const elements = document.elements.map((element, index) => ({
    data: element,
    designId: id,
    id: element.id,
    position: positions[index] ?? "",
  }));
  // With rows for its images, which its photos point at
  await db.batch([
    design,
    ...(template.assets.length > 0
      ? [
          db
            .insert(assets)
            .values(template.assets.map(templateAssetRow))
            .onConflictDoNothing(),
        ]
      : []),
    ...(elements.length > 0
      ? [db.insert(designElements).values(elements)]
      : []),
  ]);

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
