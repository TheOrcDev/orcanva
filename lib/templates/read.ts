import "server-only";
import { TEMPLATE_FILES } from "@/lib/templates/documents";
import { templateSchema } from "@/lib/templates/schema";
import type { Template } from "@/lib/templates/schema";

// A starter template's file, checked against the schema
export const readTemplate = async (id: string): Promise<Template> => {
  const load = Object.hasOwn(TEMPLATE_FILES, id) ? TEMPLATE_FILES[id] : null;
  if (!load) {
    throw new Error("Template not found");
  }
  return templateSchema.parse(await load());
};
