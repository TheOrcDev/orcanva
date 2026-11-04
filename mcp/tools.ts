// The Orcanva MCP server's tools, for mcp/server.ts to serve over stdio
// (and tests to call in memory). Everything an agent can do to designs.
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { generateNKeysBetween } from "fractional-indexing";
import { z } from "zod";

import { SIZE_PRESETS, findPresetById } from "@/lib/document/presets";
import { MAX_CANVAS_SIZE, MIN_CANVAS_SIZE } from "@/lib/document/schema";
import type { DesignElement } from "@/lib/document/schema";
import { FONT_CATALOG } from "@/lib/fonts/catalog";
import { GRAPHIC_KINDS } from "@/lib/graphics/entry";
import { TEMPLATES } from "@/lib/templates/catalog";

import {
  backgroundSpec,
  buildBox,
  buildGraphic,
  buildImage,
  buildLine,
  buildText,
  elementSpec,
  patchElement,
  summarizeElement,
  toBackground,
} from "./builders";
import type { ElementSpec } from "./builders";
import { findGraphics, resolveGraphic } from "./graphics";
import {
  allElements,
  applyChanges,
  createDesign,
  designUrl,
  listDesigns,
  newPositions,
  pageOf,
  readDesign,
  readThumbnail,
  uploadImage,
} from "./store";

const json = (value: unknown): CallToolResult => ({
  content: [{ text: JSON.stringify(value, null, 2), type: "text" }],
});

// The app's env is checked on first use; say which settings are missing
// rather than dumping the schema's issues
const errorText = (error: unknown): string => {
  if (error instanceof z.ZodError) {
    const names = [
      ...new Set(error.issues.map((issue) => issue.path.join("."))),
    ];
    return `Orcanva's .env.local is missing or incomplete (see DEVELOPMENT.md): ${names.join(", ")}`;
  }
  return error instanceof Error ? error.message : String(error);
};

// Tool errors go back to the agent as a result it can read and fix, rather
// than as a protocol error
const tool =
  <Args>(run: (args: Args) => CallToolResult | Promise<CallToolResult>) =>
  async (args: Args): Promise<CallToolResult> => {
    try {
      return await run(args);
    } catch (error) {
      return {
        content: [{ text: errorText(error), type: "text" }],
        isError: true,
      };
    }
  };

const designId = z.uuid().describe("The design's id (from list_designs)");
const pageId = z
  .string()
  .optional()
  .describe("Which page; default the first. Ids come from get_design");

// A design as an agent reads it: its size, link and pages with elements
// bottom to top
const describeDesign = async (id: string) => {
  const { pages, row } = await readDesign(id);
  return {
    height: row.height,
    id: row.id,
    name: row.name,
    pages: pages.map((page) => ({
      background: page.document.background,
      elements: page.document.elements.map(summarizeElement),
      id: page.id,
    })),
    url: designUrl(row.id),
    width: row.width,
  };
};

const buildElement = async (
  spec: ElementSpec,
  page: { width: number; height: number }
): Promise<DesignElement> => {
  switch (spec.type) {
    case "text": {
      return buildText(spec, page);
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
      return buildGraphic(spec, await resolveGraphic(spec.graphic), page);
    }
    case "image": {
      return buildImage(spec, await uploadImage(spec.source), page);
    }
    default: {
      throw new Error("Unknown element type");
    }
  }
};

const INSTRUCTIONS = `Orcanva is a design editor for YouTube thumbnails and social images. Use these tools to make and edit designs in the user's Orcanva account; open editors show changes live.

Workflow: create_design (or list_designs / get_design for an existing one) → add_elements → get_design to check the result → update_elements to adjust. Coordinates are page pixels from the top-left; elements are listed bottom to top (later ones draw on top). Text height is estimated until an editor measures it. Always give the user the design's url when you're done. get_preview returns the picture an open editor last rendered, which may lag behind your latest edits.

Good thumbnails: big bold display fonts (anton, bebas-neue, bangers, luckiest-guy) with an outline or shadow, high contrast, 3–6 words of text, one clear focal point.`;

export const createServer = (): McpServer => {
  const server = new McpServer(
    { name: "orcanva", version: "0.1.0" },
    { instructions: INSTRUCTIONS }
  );

  server.registerTool(
    "list_sizes",
    {
      annotations: { readOnlyHint: true },
      description: "Size presets for new designs (YouTube thumbnail, story, …)",
    },
    tool(() =>
      json(
        SIZE_PRESETS.map(({ description, height, id, width }) => ({
          description,
          height,
          id,
          width,
        }))
      )
    )
  );

  server.registerTool(
    "list_fonts",
    {
      annotations: { readOnlyHint: true },
      description: "Fonts text can use, with their category and weights",
    },
    tool(() =>
      json(
        FONT_CATALOG.map(({ category, family, id, italic, weights }) => ({
          category,
          family,
          id,
          italic,
          weights,
        }))
      )
    )
  );

  server.registerTool(
    "list_templates",
    {
      annotations: { readOnlyHint: true },
      description:
        "Starter templates create_design can start from, with their size and tags",
    },
    tool(() =>
      json(
        TEMPLATES.map(
          ({ category, height, id, name, presetId, tags, width }) => ({
            category,
            height,
            id,
            name,
            presetId,
            tags,
            width,
          })
        )
      )
    )
  );

  server.registerTool(
    "search_graphics",
    {
      annotations: { readOnlyHint: true },
      description:
        "Search thousands of icons, emoji and stickers by keyword. Use an id with add_elements' graphic type.",
      inputSchema: {
        kind: z.enum([...GRAPHIC_KINDS, "all"]).default("all"),
        limit: z.number().int().min(1).max(50).default(15),
        query: z.string().min(1),
      },
    },
    tool(async ({ kind, limit, query }) =>
      json(await findGraphics(query, kind, limit))
    )
  );

  server.registerTool(
    "list_designs",
    {
      annotations: { readOnlyHint: true },
      description:
        "The account's own designs and ones shared with it, newest first",
    },
    tool(async () => json(await listDesigns()))
  );

  server.registerTool(
    "create_design",
    {
      description:
        "Make a new private design, blank or from a template, and get its id and editor link",
      inputSchema: {
        background: backgroundSpec.optional(),
        height: z
          .number()
          .int()
          .min(MIN_CANVAS_SIZE)
          .max(MAX_CANVAS_SIZE)
          .optional(),
        name: z.string().trim().min(1).max(120).optional(),
        size: z
          .string()
          .optional()
          .describe(
            "A size preset id from list_sizes. Default youtube-thumbnail"
          ),
        template: z
          .string()
          .optional()
          .describe("A template id from list_templates to start from"),
        width: z
          .number()
          .int()
          .min(MIN_CANVAS_SIZE)
          .max(MAX_CANVAS_SIZE)
          .optional(),
      },
    },
    tool(async ({ background, height, name, size, template, width }) => {
      const templateSummary = template
        ? TEMPLATES.find((candidate) => candidate.id === template)
        : undefined;
      if (template && !templateSummary) {
        throw new Error(`No template "${template}"; see list_templates`);
      }
      const presetId = size ?? templateSummary?.presetId ?? "youtube-thumbnail";
      const preset = findPresetById(presetId);
      if (!preset) {
        throw new Error(`No size "${presetId}"; see list_sizes`);
      }
      if ((width === undefined) !== (height === undefined)) {
        throw new Error("Give both width and height, or neither");
      }
      const { id } = await createDesign({
        background: background ? toBackground(background) : null,
        height: height ?? preset.height,
        name: name ?? templateSummary?.name ?? preset.label,
        templateId: template ?? null,
        width: width ?? preset.width,
      });
      return json(await describeDesign(id));
    })
  );

  server.registerTool(
    "get_design",
    {
      annotations: { readOnlyHint: true },
      description:
        "A design's size, link, pages and every element's fields, bottom to top",
      inputSchema: { design_id: designId },
    },
    tool(async ({ design_id }) => json(await describeDesign(design_id)))
  );

  server.registerTool(
    "add_elements",
    {
      description:
        "Add text, shapes (rect, ellipse, line, arrow), graphics (icons/emoji/stickers) and images to a page, on top of what's there, in the order given",
      inputSchema: {
        design_id: designId,
        elements: z.array(elementSpec).min(1).max(50),
        page_id: pageId,
      },
    },
    tool(async ({ design_id, elements, page_id }) => {
      const content = await readDesign(design_id);
      const page = pageOf(content, page_id);
      const size = { height: content.row.height, width: content.row.width };
      // Built together (images upload in parallel); nothing is saved unless
      // every one of them is good
      const built = await Promise.all(
        elements.map(async (spec, index) => {
          try {
            return await buildElement(spec, size);
          } catch (error) {
            const reason =
              error instanceof Error ? error.message : String(error);
            throw new Error(`Element ${index} (${spec.type}): ${reason}`, {
              cause: error,
            });
          }
        })
      );
      const positions = newPositions(content, built.length);
      await applyChanges(design_id, {
        writes: built.map((data, index) => ({
          data,
          mode: "create",
          pageId: page.id,
          position: positions[index] ?? "a0",
        })),
      });
      return json({
        added: built.map(summarizeElement),
        url: designUrl(design_id),
      });
    })
  );

  server.registerTool(
    "update_elements",
    {
      description:
        "Change elements' fields (as get_design names them: x, y, width, text, fill, fontSize, stroke, …) and/or bring them to the front or send them to the back",
      inputSchema: {
        design_id: designId,
        updates: z
          .array(
            z.object({
              id: z.string().min(1),
              order: z.enum(["front", "back"]).optional(),
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
    },
    tool(async ({ design_id, updates }) => {
      const content = await readDesign(design_id);
      const byId = new Map(
        allElements(content).map((entry) => [entry.element.id, entry])
      );
      const front = updates.filter((update) => update.order === "front");
      const back = updates.filter((update) => update.order === "back");
      const frontKeys = new Map(
        front.map((update, index) => [
          update.id,
          newPositions(content, front.length, "front")[index],
        ])
      );
      const backKeys = new Map(
        back.map((update, index) => [
          update.id,
          newPositions(content, back.length, "back")[index],
        ])
      );
      const writes = updates.map((update) => {
        const entry = byId.get(update.id);
        if (!entry) {
          throw new Error(`No element ${update.id}; see get_design`);
        }
        const data = patchElement(entry.element, update.set);
        return {
          data,
          mode: "update" as const,
          pageId: entry.pageId,
          position:
            frontKeys.get(update.id) ??
            backKeys.get(update.id) ??
            entry.position,
        };
      });
      await applyChanges(design_id, { writes });
      return json({
        updated: writes.map((write) => summarizeElement(write.data)),
      });
    })
  );

  server.registerTool(
    "delete_elements",
    {
      annotations: { destructiveHint: true },
      description:
        "Remove elements from a design (undo in the editor or version history brings them back)",
      inputSchema: {
        design_id: designId,
        ids: z.array(z.string().min(1)).min(1).max(500),
      },
    },
    tool(async ({ design_id, ids }) => {
      const content = await readDesign(design_id);
      const known = new Set(
        allElements(content).map((entry) => entry.element.id)
      );
      const missing = ids.filter((id) => !known.has(id));
      if (missing.length > 0) {
        throw new Error(`No element(s) ${missing.join(", ")}; see get_design`);
      }
      await applyChanges(design_id, { deletes: ids });
      return json({ deleted: ids });
    })
  );

  server.registerTool(
    "set_background",
    {
      description: "Set a page's background to a solid colour or a gradient",
      inputSchema: {
        background: backgroundSpec,
        design_id: designId,
        page_id: pageId,
      },
    },
    tool(async ({ background, design_id, page_id }) => {
      const content = await readDesign(design_id);
      const page = pageOf(content, page_id);
      const value = toBackground(background);
      await applyChanges(design_id, {
        pages: [
          {
            background: value,
            id: page.id,
            mode: "update",
            position: page.position,
          },
        ],
      });
      return json({ background: value, page_id: page.id });
    })
  );

  server.registerTool(
    "add_page",
    {
      description:
        "Add a page after the last one (for carousels); returns its id for add_elements",
      inputSchema: {
        background: backgroundSpec.optional(),
        design_id: designId,
      },
    },
    tool(async ({ background, design_id }) => {
      const content = await readDesign(design_id);
      const last = content.pages.at(-1);
      const [position] = generateNKeysBetween(last?.position ?? null, null, 1);
      const id = crypto.randomUUID();
      const value = background
        ? toBackground(background)
        : { color: "#ffffff", type: "solid" as const };
      await applyChanges(design_id, {
        pages: [
          { background: value, id, mode: "create", position: position ?? "a1" },
        ],
      });
      return json({ page_id: id, pages: content.pages.length + 1 });
    })
  );

  server.registerTool(
    "rename_design",
    {
      description: "Rename a design (only its owner can)",
      inputSchema: {
        design_id: designId,
        name: z.string().trim().min(1).max(120),
      },
    },
    tool(async ({ design_id, name }) => {
      await readDesign(design_id);
      await applyChanges(design_id, { name });
      return json({ name });
    })
  );

  server.registerTool(
    "get_preview",
    {
      annotations: { readOnlyHint: true },
      description:
        "The design's latest picture (≤640px JPEG), as an open editor last rendered it. Ask the user to open the design's url if it's missing or out of date.",
      inputSchema: { design_id: designId },
    },
    tool(async ({ design_id }) => {
      await readDesign(design_id);
      const picture = await readThumbnail(design_id);
      if (!picture) {
        return json({
          message: `No preview yet: open ${designUrl(design_id)} in a browser and it renders one`,
        });
      }
      return {
        content: [{ ...picture, type: "image" }],
      };
    })
  );

  return server;
};
