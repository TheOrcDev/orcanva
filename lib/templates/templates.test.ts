import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { migrateDocument } from "@/lib/document/migrate";
import { findPresetById } from "@/lib/document/presets";
import { MAX_ELEMENT_JSON_LENGTH } from "@/lib/document/schema";
import { findFont } from "@/lib/fonts/catalog";
import { TEMPLATES } from "@/lib/templates/catalog";
import {
  sha256Hex,
  sortTemplates,
  summarizeTemplate,
  templateAssetId,
  templateImageFile,
} from "@/lib/templates/export";
import { templateSchema } from "@/lib/templates/schema";
import type { Template } from "@/lib/templates/schema";

vi.mock("server-only", () => ({}));

const ROOT = path.join(import.meta.dirname, "../..");
const DATA = path.join(ROOT, "lib/templates/data");
const FILES = path.join(ROOT, "public/template-files");

const filesIn = (folder: string): string[] =>
  existsSync(folder)
    ? readdirSync(folder).filter((name) => !name.startsWith("."))
    : [];

const files = filesIn(DATA).map((name) => ({
  name,
  template: templateSchema.parse(
    JSON.parse(readFileSync(path.join(DATA, name), "utf-8"))
  ),
}));
const templates: Template[] = files.map((file) => file.template);

const rawElements = (template: Template): unknown[] => {
  const { document } = template;
  return typeof document === "object" &&
    document !== null &&
    "elements" in document &&
    Array.isArray(document.elements)
    ? document.elements
    : [];
};

describe.each(templates.map((template) => [template.id, template]))(
  "template %s",
  (_id, template) => {
    const document = migrateDocument(template.document);

    it("migrates whole, at its preset's size", () => {
      expect(document.elements).toHaveLength(rawElements(template).length);
      const preset = findPresetById(template.presetId);
      expect({ height: document.height, width: document.width }).toEqual({
        height: preset?.height,
        width: preset?.width,
      });
    });

    it("only uses fonts from the catalog", () => {
      for (const element of document.elements) {
        if (element.type === "text") {
          const ids = [
            element.fontId,
            ...element.marks.flatMap((mark) => mark.fontId ?? []),
          ];
          for (const id of ids) {
            expect(findFont(id), `${element.name}: ${id}`).toBeDefined();
          }
        }
      }
    });

    it("keeps every element under the size limit", () => {
      for (const element of rawElements(template)) {
        expect(JSON.stringify(element).length).toBeLessThan(
          MAX_ELEMENT_JSON_LENGTH
        );
      }
    });

    it("lists exactly the images it shows", () => {
      const shown = new Set(
        document.elements.flatMap((element) =>
          (element.type === "image" || element.type === "frame") &&
          element.assetId
            ? [element.assetId]
            : []
        )
      );
      const listed = template.assets.map((asset) => asset.id);
      expect(new Set(listed).size).toBe(listed.length);
      expect(new Set(listed)).toEqual(shown);
    });

    it("has its preview and image files", () => {
      expect(existsSync(path.join(FILES, "previews", template.preview))).toBe(
        true
      );
      for (const asset of template.assets) {
        const bytes = readFileSync(path.join(FILES, "images", asset.file));
        const sha256 = sha256Hex(bytes);
        expect(asset.file).toBe(
          templateImageFile(sha256, asset.file.split(".").at(-1) ?? "")
        );
        expect(asset.id).toBe(templateAssetId(sha256));
        expect(asset.bytes).toBe(bytes.length);
      }
    });
  }
);

describe("templates", () => {
  it("are named by their ids, which are unique", () => {
    for (const { name, template } of files) {
      expect(name).toBe(`${template.id}.json`);
    }
    const ids = templates.map((template) => template.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("are all in the catalog", () => {
    expect(TEMPLATES).toEqual(sortTemplates(templates).map(summarizeTemplate));
  });

  it("all have a loader", async () => {
    const { TEMPLATE_FILES } = await import("@/lib/templates/documents");
    expect(Object.keys(TEMPLATE_FILES).toSorted()).toEqual(
      templates.map((template) => template.id).toSorted()
    );
  });

  it("leave no files behind", () => {
    const previews = new Set(templates.map((template) => template.preview));
    const images = new Set(
      templates.flatMap((template) =>
        template.assets.map((asset) => asset.file)
      )
    );
    expect(filesIn(path.join(FILES, "previews")).toSorted()).toEqual(
      [...previews].toSorted()
    );
    expect(filesIn(path.join(FILES, "images")).toSorted()).toEqual(
      [...images].toSorted()
    );
  });
});
