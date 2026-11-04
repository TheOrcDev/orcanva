// The editor's WebMCP tools: what an AI agent in the browser can do to the
// design on screen, as the person using it. Every edit goes through the
// editor store, so it saves, syncs to everyone on the design and undoes
// with Ctrl+Z like the person's own. Browser-only work (drawing, uploads,
// fonts, AI models) comes in through `EditorToolDeps`, so the tools
// themselves run anywhere (and in tests).
import { z } from "zod";

import {
  backgroundSpec,
  buildBox,
  buildGraphic,
  buildImage,
  buildLine,
  buildText,
  elementSpec,
  patchElement,
  placeBox,
  summarizeElement,
  toBackground,
} from "@/lib/agent/specs";
import type { ElementSpec } from "@/lib/agent/specs";
import { slugify } from "@/lib/document/geometry";
import type { Size } from "@/lib/document/geometry";
import { MAX_ELEMENTS } from "@/lib/document/schema";
import type {
  DesignDocument,
  DesignElement,
  TextElement,
} from "@/lib/document/schema";
import {
  appendElements,
  arrangeElements,
  removeElements,
  setBackground,
} from "@/lib/editor/document-ops";
import { selectDocument, selectWholeDesign } from "@/lib/editor/store";
import type { EditorAsset, EditorStoreApi } from "@/lib/editor/store";
import type { RenderOptions } from "@/lib/export/render-page";
import { FONT_CATALOG } from "@/lib/fonts/catalog";
import { GRAPHIC_KINDS } from "@/lib/graphics/entry";
import type { GraphicEntry, GraphicKind } from "@/lib/graphics/entry";
import { addToPage, replacePage } from "@/lib/templates/apply";
import { TEMPLATES } from "@/lib/templates/catalog";

export interface GraphicHit {
  id: string;
  kind: GraphicKind;
  name: string;
}

export interface EditorToolDeps {
  store: EditorStoreApi;
  // Draws the page on screen, as Download does
  render: (options: RenderOptions) => Promise<Blob>;
  // A text's box as this browser draws it, once its font has loaded
  measureText: (text: TextElement) => Promise<Size>;
  searchGraphics: (
    query: string,
    kind: GraphicKind | "all",
    limit: number
  ) => Promise<GraphicHit[]>;
  // A graphic by id, or the best match for some words
  resolveGraphic: (idOrQuery: string) => Promise<GraphicEntry>;
  // Fetches an image and adds it to the person's uploads
  uploadFromUrl: (url: string) => Promise<EditorAsset>;
  loadTemplate: (
    templateId: string
  ) => Promise<{ assets: EditorAsset[]; document: DesignDocument }>;
  removeBackground: (elementId: string) => Promise<void>;
  // Resolves with the factor it managed (limits can cap it)
  upscale: (elementId: string, factor: 2 | 4) => Promise<number>;
  download: (blob: Blob, filename: string) => void;
  // Tells the person what the agent just did
  notify: (message: string) => void;
}

// MCP's tool result shape, which WebMCP agents and bridges read
export type ToolResult =
  | { content: { type: "text"; text: string }[]; isError?: boolean }
  | { content: { type: "image"; data: string; mimeType: string }[] };

const json = (value: unknown): ToolResult => ({
  content: [{ text: JSON.stringify(value, null, 2), type: "text" }],
});

const failure = (message: string): ToolResult => ({
  content: [{ text: message, type: "text" }],
  isError: true,
});

// Why the design can't be edited from this tab right now, if it can't
const blockedReason = (store: EditorStoreApi): string | null => {
  const state = store.getState();
  if (state.outdated) {
    return "This tab is out of date; ask the person to reload the page";
  }
  if (state.accessLost) {
    return "This design is no longer available to the person";
  }
  if (state.previewVersionId) {
    return "A version from the history is open; ask the person to close it first";
  }
  return null;
};

// Agents may hand over the arguments as a JSON string
const argsOf = (raw: unknown): unknown => {
  if (typeof raw !== "string") {
    return raw ?? {};
  }
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
};

interface ToolDefinition<Shape extends z.ZodRawShape> {
  name: string;
  description: string;
  input: Shape;
  annotations?: ModelContextToolAnnotations;
  // Changes the design, so it waits while the tab can't edit
  edits?: boolean;
  run: (args: z.output<z.ZodObject<Shape>>) => ToolResult | Promise<ToolResult>;
}

const defineTool = <Shape extends z.ZodRawShape>(
  store: EditorStoreApi,
  { annotations, description, edits, input, name, run }: ToolDefinition<Shape>
): ModelContextTool => {
  const schema = z.object(input);
  return {
    annotations,
    description,
    execute: async (raw) => {
      const parsed = schema.safeParse(argsOf(raw));
      if (!parsed.success) {
        return failure(z.prettifyError(parsed.error));
      }
      const blocked = edits ? blockedReason(store) : null;
      if (blocked) {
        return failure(blocked);
      }
      try {
        return await run(parsed.data);
      } catch (error) {
        return failure(error instanceof Error ? error.message : String(error));
      }
    },
    inputSchema: z.toJSONSchema(schema, { io: "input" }),
    name,
  };
};

const plural = (count: number, noun: string) =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;

// A text placed by keyword or left to centre lands where it was meant to
// once its real height is known (specs can only estimate it)
const settleText = async (
  element: DesignElement,
  spec: ElementSpec,
  page: Size,
  measure: EditorToolDeps["measureText"]
): Promise<DesignElement> => {
  if (element.type !== "text" || spec.type !== "text" || spec.y !== undefined) {
    return element;
  }
  const { height } = await measure(element);
  const spot = placeBox(
    spec.place ?? "center",
    { height, width: element.width },
    page
  );
  return { ...element, x: spec.x ?? spot.x, y: spot.y };
};

const buildElement = async (
  deps: EditorToolDeps,
  spec: ElementSpec,
  page: Size
): Promise<DesignElement> => {
  switch (spec.type) {
    case "text": {
      return settleText(buildText(spec, page), spec, page, deps.measureText);
    }
    case "rect":
    case "ellipse": {
      return buildBox(spec, page);
    }
    case "line":
    case "arrow": {
      return buildLine(spec, page);
    }
    case "graphic": {
      return buildGraphic(spec, await deps.resolveGraphic(spec.graphic), page);
    }
    case "image": {
      const asset = await deps.uploadFromUrl(spec.source);
      deps.store.getState().addAsset(asset);
      return buildImage(spec, asset, page);
    }
    default: {
      throw new Error("Unknown element type");
    }
  }
};

// Shows the page the agent works on, so the person sees it happen
const goToPage = (store: EditorStoreApi, pageId: string | undefined) => {
  const state = store.getState();
  if (!pageId || pageId === state.activePageId) {
    return;
  }
  if (!state.pages.some((page) => page.id === pageId)) {
    throw new Error(
      `No page ${pageId}; pages are ${state.pages.map((page) => page.id).join(", ")}`
    );
  }
  state.setActivePage(pageId);
};

// Ends a crop, an erase or typing, as the panels do before changing things
const settleEditing = (store: EditorStoreApi) => {
  const state = store.getState();
  state.finishCrop(true);
  state.finishPageCrop(false);
  state.setEditingText(null);
};

const describeElement = async (
  element: DesignElement,
  measure: EditorToolDeps["measureText"]
): Promise<Record<string, unknown>> => {
  const summary = summarizeElement(element);
  if (element.type !== "text") {
    return summary;
  }
  const { estimatedHeight: _estimate, ...rest } = summary;
  try {
    const { height } = await measure(element);
    return { ...rest, height: Math.round(height) };
  } catch {
    return summary;
  }
};

const describeDesign = async (deps: EditorToolDeps) => {
  const state = deps.store.getState();
  const { height, width } = selectDocument(state);
  return {
    activePageId: state.activePageId,
    height,
    name: state.name,
    pages: await Promise.all(
      state.pages.map(async (page) => ({
        background: page.doc.document.background,
        elements: await Promise.all(
          page.doc.document.elements.map((element) =>
            describeElement(element, deps.measureText)
          )
        ),
        id: page.id,
      }))
    ),
    selectedIds: state.selectedIds,
    width,
  };
};

const PREVIEW_MAX_SIDE = 1024;
const PREVIEW_QUALITY = 0.85;
const BASE64_CHUNK = 0x80_00;

const base64Of = async (blob: Blob): Promise<string> => {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let index = 0; index < bytes.length; index += BASE64_CHUNK) {
    binary += String.fromCodePoint(
      ...bytes.subarray(index, index + BASE64_CHUNK)
    );
  }
  return btoa(binary);
};

const DOWNLOAD_EXTENSIONS = { jpeg: "jpg", png: "png", webp: "webp" } as const;

const INTRO =
  "Orcanva is a design editor for YouTube thumbnails and social images. These tools act on the design open in this tab, as the person using it: changes appear on their screen and save as they happen, and the person can undo them. Coordinates are page pixels from the top-left; elements are listed bottom to top.";

export const editorTools = (deps: EditorToolDeps): ModelContextTool[] => {
  const { store } = deps;
  const pageSize = (): Size => {
    const { height, width } = selectDocument(store.getState());
    return { height, width };
  };

  return [
    defineTool(store, {
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      description: `${INTRO} Returns the design's name, size, the page on screen, what's selected, and every page with its background and elements (all their fields). Call this first.`,
      input: {},
      name: "get_design",
      run: async () => json(await describeDesign(deps)),
    }),

    defineTool(store, {
      annotations: { readOnlyHint: true },
      description:
        "Fonts text can use (ids for add_elements' font), with category and weights. Display fonts like anton, bebas-neue and bangers suit thumbnails.",
      input: {},
      name: "list_fonts",
      run: () =>
        json(
          FONT_CATALOG.map(({ category, family, id, italic, weights }) => ({
            category,
            family,
            id,
            italic,
            weights,
          }))
        ),
    }),

    defineTool(store, {
      annotations: { readOnlyHint: true },
      description:
        "Search the icons, emoji and stickers. Use an id as add_elements' graphic.",
      input: {
        kind: z.enum([...GRAPHIC_KINDS, "all"]).default("all"),
        limit: z.number().int().min(1).max(50).default(15),
        query: z.string().min(1),
      },
      name: "search_graphics",
      run: async ({ kind, limit, query }) =>
        json(await deps.searchGraphics(query, kind, limit)),
    }),

    defineTool(store, {
      annotations: { readOnlyHint: true },
      description:
        "Starter templates apply_template can use, with their size and tags",
      input: {},
      name: "list_templates",
      run: () =>
        json(
          TEMPLATES.map(({ category, height, id, name, tags, width }) => ({
            category,
            height,
            id,
            name,
            tags,
            width,
          }))
        ),
    }),

    defineTool(store, {
      description:
        "Add text, shapes (rect, ellipse, line, arrow), graphics (icons/emoji/stickers) and images (from a URL) on top of a page, in the order given, as one undo step. Switches to that page and selects what it added.",
      edits: true,
      input: {
        elements: z.array(elementSpec).min(1).max(50),
        page_id: z
          .string()
          .optional()
          .describe("Which page; default the one on screen"),
      },
      name: "add_elements",
      run: async ({ elements, page_id }) => {
        goToPage(store, page_id);
        settleEditing(store);
        const page = pageSize();
        const built = await Promise.all(
          elements.map(async (spec, index) => {
            try {
              return await buildElement(deps, spec, page);
            } catch (error) {
              const reason =
                error instanceof Error ? error.message : String(error);
              throw new Error(`Element ${index} (${spec.type}): ${reason}`, {
                cause: error,
              });
            }
          })
        );
        const total = selectWholeDesign(store.getState()).elements.length;
        if (total + built.length > MAX_ELEMENTS) {
          throw new Error(
            `A design holds at most ${MAX_ELEMENTS} elements; it has ${total}`
          );
        }
        const state = store.getState();
        state.change((document) => appendElements(document, built));
        state.select(built.map((element) => element.id));
        deps.notify(`AI agent added ${plural(built.length, "element")}`);
        return json({
          added: await Promise.all(
            built.map((element) => describeElement(element, deps.measureText))
          ),
        });
      },
    }),

    defineTool(store, {
      description:
        "Change elements' fields (as get_design names them: x, y, width, height, text, fill, fontSize, fontId, stroke, opacity, rotation, locked, …) and/or move them in the stack, on any page, as one undo step",
      edits: true,
      input: {
        updates: z
          .array(
            z.object({
              id: z.string().min(1),
              order: z
                .enum(["front", "back", "forward", "backward"])
                .optional(),
              set: z
                .record(z.string(), z.unknown())
                .default({})
                .describe(
                  'Fields to replace, e.g. {"text": "NEW", "fill": "#ff0000"}'
                ),
            })
          )
          .min(1)
          .max(100),
      },
      name: "update_elements",
      run: async ({ updates }) => {
        settleEditing(store);
        const all = selectWholeDesign(store.getState()).elements;
        const byId = new Map(all.map((element) => [element.id, element]));
        // Checked up front, so a bad update changes nothing
        const patched = new Map(
          updates.map((update) => {
            const element = byId.get(update.id);
            if (!element) {
              throw new Error(`No element ${update.id}; see get_design`);
            }
            return [update.id, patchElement(element, update.set)] as const;
          })
        );
        store.getState().changeAllPages((document) => {
          let next = document;
          if (document.elements.some((element) => patched.has(element.id))) {
            next = {
              ...document,
              elements: document.elements.map(
                (element) => patched.get(element.id) ?? element
              ),
            };
          }
          for (const update of updates) {
            if (update.order) {
              next = arrangeElements(next, [update.id], update.order);
            }
          }
          return next;
        });
        deps.notify(`AI agent changed ${plural(updates.length, "element")}`);
        return json({
          updated: await Promise.all(
            [...patched.values()].map((element) =>
              describeElement(element, deps.measureText)
            )
          ),
        });
      },
    }),

    defineTool(store, {
      annotations: { destructiveHint: true },
      description:
        "Remove elements from any page, as one undo step. Locked elements stay unless unlocked first.",
      edits: true,
      input: { ids: z.array(z.string().min(1)).min(1).max(500) },
      name: "delete_elements",
      run: ({ ids }) => {
        settleEditing(store);
        const all = selectWholeDesign(store.getState()).elements;
        const byId = new Map(all.map((element) => [element.id, element]));
        const missing = ids.filter((id) => !byId.has(id));
        if (missing.length > 0) {
          throw new Error(
            `No element(s) ${missing.join(", ")}; see get_design`
          );
        }
        const locked = ids.filter((id) => byId.get(id)?.locked);
        if (locked.length > 0) {
          throw new Error(
            `Locked: ${locked.join(", ")}. Unlock them with update_elements ({"locked": false}) if the person wants them gone.`
          );
        }
        const state = store.getState();
        state.changeAllPages((document) => removeElements(document, ids));
        state.select(state.selectedIds.filter((id) => !ids.includes(id)));
        deps.notify(`AI agent removed ${plural(ids.length, "element")}`);
        return json({ deleted: ids });
      },
    }),

    defineTool(store, {
      description:
        "Select elements in the editor, to point the person at them (an empty list clears the selection). Switches to their page.",
      input: { ids: z.array(z.string().min(1)).max(500) },
      name: "select_elements",
      run: ({ ids }) => {
        const state = store.getState();
        const page = state.pages.find((candidate) =>
          candidate.doc.document.elements.some(
            (element) => element.id === ids[0]
          )
        );
        goToPage(store, page?.id);
        const onPage = new Set(
          selectDocument(store.getState()).elements.map((element) => element.id)
        );
        const selected = ids.filter((id) => onPage.has(id));
        store.getState().select(selected);
        return json({ selected });
      },
    }),

    defineTool(store, {
      description:
        "Set a page's background to a solid colour or a linear gradient. Switches to that page.",
      edits: true,
      input: {
        background: backgroundSpec,
        page_id: z.string().optional().describe("Default the page on screen"),
      },
      name: "set_background",
      run: ({ background, page_id }) => {
        goToPage(store, page_id);
        const value = toBackground(background);
        store.getState().change((document) => setBackground(document, value));
        deps.notify("AI agent changed the background");
        return json({
          background: value,
          page_id: store.getState().activePageId,
        });
      },
    }),

    defineTool(store, {
      description:
        "Add a blank page after the one on screen (for carousels) and switch to it; returns its id",
      edits: true,
      input: { background: backgroundSpec.optional() },
      name: "add_page",
      run: ({ background }) => {
        settleEditing(store);
        const id = store.getState().addPage();
        if (!id) {
          throw new Error("The design already has as many pages as it can");
        }
        goToPage(store, id);
        if (background) {
          const value = toBackground(background);
          store.getState().change((document) => setBackground(document, value));
        }
        deps.notify("AI agent added a page");
        return json({ page_id: id, pages: store.getState().pages.length });
      },
    }),

    defineTool(store, {
      description: "Show another page of the design in the editor",
      input: { page_id: z.string().min(1) },
      name: "go_to_page",
      run: ({ page_id }) => {
        goToPage(store, page_id);
        return json({ page_id });
      },
    }),

    defineTool(store, {
      description:
        "Put a starter template on the page on screen: `add` puts its elements on top of what's there; `replace` swaps the page's elements and background for the template's. One undo step.",
      edits: true,
      input: {
        mode: z.enum(["add", "replace"]).default("add"),
        template: z
          .string()
          .min(1)
          .describe("A template id from list_templates"),
      },
      name: "apply_template",
      run: async ({ mode, template }) => {
        if (!TEMPLATES.some((candidate) => candidate.id === template)) {
          throw new Error(`No template "${template}"; see list_templates`);
        }
        const loaded = await deps.loadTemplate(template);
        settleEditing(store);
        const state = store.getState();
        state.addAssets(loaded.assets);
        if (mode === "replace") {
          // Every page shares one size: with several, the page keeps its own
          const keepSize = state.pages.length > 1;
          state.change((document) =>
            replacePage(document, loaded.document, keepSize)
          );
          state.zoomToFit();
          state.clearSelection();
        } else {
          let added: string[] = [];
          state.change((document) => {
            const result = addToPage(document, loaded.document);
            added = result.ids;
            return result.document;
          });
          state.select(added);
        }
        deps.notify(`AI agent applied the ${template} template`);
        return json(await describeDesign(deps));
      },
    }),

    defineTool(store, {
      description:
        "Cut the background out of an image (or a frame's photo), in the browser. The cutout is saved to the person's uploads and swapped in; the first run downloads a ~220 MB model.",
      edits: true,
      input: { element_id: z.string().min(1) },
      name: "remove_background",
      run: async ({ element_id }) => {
        await deps.removeBackground(element_id);
        deps.notify("AI agent removed an image's background");
        return json({ done: true, element_id });
      },
    }),

    defineTool(store, {
      description:
        "Make an image (or a frame's photo) sharper by upscaling it 2× or 4× with an AI model in the browser; the element keeps its size",
      edits: true,
      input: {
        element_id: z.string().min(1),
        factor: z.union([z.literal(2), z.literal(4)]).default(2),
      },
      name: "upscale_image",
      run: async ({ element_id, factor }) => {
        const reached = await deps.upscale(element_id, factor);
        deps.notify("AI agent upscaled an image");
        return json({ element_id, factor: reached });
      },
    }),

    defineTool(store, {
      annotations: { readOnlyHint: true },
      description:
        "See the page on screen as it's drawn (a JPEG, at most 1024px), to check your work",
      input: {},
      name: "get_preview",
      run: async () => {
        const { height, width } = pageSize();
        settleEditing(store);
        const blob = await deps.render({
          format: "jpeg",
          pixelRatio: Math.min(1, PREVIEW_MAX_SIDE / Math.max(width, height)),
          quality: PREVIEW_QUALITY,
        });
        return {
          content: [
            {
              data: await base64Of(blob),
              mimeType: "image/jpeg",
              type: "image",
            },
          ],
        };
      },
    }),

    defineTool(store, {
      description:
        "Download the page on screen as an image file to the person's computer",
      input: {
        format: z.enum(["png", "jpeg", "webp"]).default("png"),
        scale: z
          .number()
          .min(0.25)
          .max(4)
          .default(1)
          .describe("Output pixels per design pixel"),
      },
      name: "download",
      run: async ({ format, scale }) => {
        const { height, width } = pageSize();
        settleEditing(store);
        const blob = await deps.render({
          format,
          pixelRatio: scale,
          quality: format === "png" ? undefined : 0.92,
        });
        const filename = `${slugify(store.getState().name)}-${Math.round(width * scale)}x${Math.round(height * scale)}.${DOWNLOAD_EXTENSIONS[format]}`;
        deps.download(blob, filename);
        return json({ downloaded: filename });
      },
    }),

    defineTool(store, {
      description:
        "Undo the last change(s) made in this tab, the agent's or the person's, like Ctrl+Z",
      edits: true,
      input: { steps: z.number().int().min(1).max(50).default(1) },
      name: "undo",
      run: ({ steps }) => {
        settleEditing(store);
        for (let step = 0; step < steps; step += 1) {
          store.getState().undo();
        }
        deps.notify(`AI agent undid ${plural(steps, "step")}`);
        return json({ undone: steps });
      },
    }),
  ];
};
