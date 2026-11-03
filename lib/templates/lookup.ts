import { TEMPLATES } from "@/lib/templates/catalog";
import type { TemplateSummary } from "@/lib/templates/schema";

export const findTemplate = (id: string): TemplateSummary | undefined =>
  TEMPLATES.find((template) => template.id === id);

// The templates made for one size preset, in catalog order
export const templatesForPreset = (
  presetId: string | null | undefined
): TemplateSummary[] =>
  presetId
    ? TEMPLATES.filter((template) => template.presetId === presetId)
    : [];
