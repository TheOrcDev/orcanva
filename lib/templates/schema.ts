import { z } from "zod";

import { PRESET_IDS } from "@/lib/document/presets";
import type { PresetId } from "@/lib/document/presets";

// Starter templates live in the repo as JSON (lib/templates/data), made by
// `pnpm template:export` from a design. Their images and previews are files
// in public/template-files, named by their content so they cache for good.

// In URLs (/new/<preset>?template=<id>): never rename one
export const TEMPLATE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
export const MIN_TEMPLATE_ID_LENGTH = 3;
export const MAX_TEMPLATE_ID_LENGTH = 48;

// The first 16 hex digits of the file's SHA-256
export const TEMPLATE_IMAGE_FILE = /^[0-9a-f]{16}\.(?:webp|jpg|png)$/u;
// <template id>.<8 hex digits of its SHA-256>.webp
export const TEMPLATE_PREVIEW_FILE = /^[a-z0-9-]+\.[0-9a-f]{8}\.webp$/u;

export const MAX_TEMPLATE_ASSETS = 20;

export const TEMPLATE_MIME_TYPES = [
  "image/webp",
  "image/jpeg",
  "image/png",
] as const;

export const templateIdSchema = z
  .string()
  .min(MIN_TEMPLATE_ID_LENGTH)
  .max(MAX_TEMPLATE_ID_LENGTH)
  .regex(TEMPLATE_ID);

export const templateAssetSchema = z.object({
  bytes: z.number().int().positive(),
  file: z.string().regex(TEMPLATE_IMAGE_FILE),
  height: z.number().int().positive(),
  // A UUIDv5 of the file's SHA-256, so the same file is always the same
  // asset row, whichever template brings it
  id: z.uuid(),
  // Only our own pictures or CC0 ones
  license: z.string().min(1).max(64),
  mimeType: z.enum(TEMPLATE_MIME_TYPES),
  name: z.string().min(1).max(200),
  // Where the picture came from
  source: z.string().min(1).max(300),
  width: z.number().int().positive(),
});

export const templateSchema = z.object({
  assets: z.array(templateAssetSchema).max(MAX_TEMPLATE_ASSETS),
  category: z.string().min(1).max(32),
  // A design document, read through migrateDocument so older files upgrade
  document: z.unknown(),
  id: templateIdSchema,
  name: z.string().min(1).max(80),
  presetId: z.enum(PRESET_IDS),
  preview: z.string().regex(TEMPLATE_PREVIEW_FILE),
  tags: z.array(z.string().min(1).max(32)).max(12),
});

export type TemplateAsset = z.infer<typeof templateAssetSchema>;
export type Template = z.infer<typeof templateSchema>;

// What lists of templates show: everything but the document and its images
export interface TemplateSummary {
  id: string;
  name: string;
  presetId: PresetId;
  category: string;
  tags: readonly string[];
  // The preview's URL: a still of the whole page
  preview: string;
  width: number;
  height: number;
}
