import { describe, expect, it, vi } from "vitest";

import { createDocument } from "@/lib/document/factories";
import type { DesignElement } from "@/lib/document/schema";
import { createEditorStore, selectWholeDesign } from "@/lib/editor/store";
import { findBuiltinGraphic } from "@/lib/graphics/builtin";
import { modelContextOf, registerTools } from "@/lib/webmcp/register";
import { editorTools } from "@/lib/webmcp/tools";
import type { EditorToolDeps } from "@/lib/webmcp/tools";

const PAGE = { height: 720, width: 1280 };
const MEASURED_HEIGHT = 150;
const ASSET = {
  height: 300,
  id: "6f1c1b7a-3f6a-4f3e-9a51-0e9f2d2b8c11",
  name: "photo.png",
  sourceAssetId: null,
  url: "/api/storage/assets/photo.png",
  variant: null,
  width: 600,
};

const setup = () => {
  const store = createEditorStore({
    assets: [],
    designId: "d",
    document: createDocument(PAGE),
    hasThumbnail: false,
    libraryIds: [],
    name: "My thumbnail",
    role: "owner",
    viewer: null,
    visibility: "public",
  });
  const notify = vi.fn<(message: string) => void>();
  const download = vi.fn<(blob: Blob, name: string) => void>();
  const deps: EditorToolDeps = {
    download,
    loadTemplate: () =>
      Promise.resolve({ assets: [], document: createDocument(PAGE) }),
    measureText: (text) =>
      Promise.resolve({ height: MEASURED_HEIGHT, width: text.width }),
    notify,
    removeBackground: () => Promise.resolve(),
    render: () => Promise.resolve(new Blob([new Uint8Array([1, 2, 3])])),
    resolveGraphic: (id) => {
      const entry = findBuiltinGraphic("sticker:arrow-bold");
      if (!entry) {
        throw new Error(`no ${id}`);
      }
      return Promise.resolve(entry);
    },
    searchGraphics: () =>
      Promise.resolve([{ id: "fluent:fire", kind: "emoji", name: "Fire" }]),
    store,
    uploadFromUrl: () => Promise.resolve(ASSET),
    upscale: (_id, factor) => Promise.resolve(factor),
  };
  const tools = new Map(editorTools(deps).map((tool) => [tool.name, tool]));
  const call = async (name: string, input: unknown = {}) => {
    const tool = tools.get(name);
    if (!tool) {
      throw new Error(`no tool ${name}`);
    }
    const result = (await tool.execute(input as Record<string, unknown>)) as {
      content: { type: string; text?: string; data?: string }[];
      isError?: boolean;
    };
    const [first] = result.content;
    if (result.isError) {
      return { error: first?.text ?? "" };
    }
    return first?.type === "text" ? JSON.parse(first.text ?? "null") : first;
  };
  const elements = (): DesignElement[] =>
    selectWholeDesign(store.getState()).elements;
  return { call, download, elements, notify, store, tools };
};

describe("editor WebMCP tools", () => {
  it("offers JSON Schemas agents can read", () => {
    const { tools } = setup();
    const add = tools.get("add_elements");
    expect(add?.inputSchema).toMatchObject({
      properties: { elements: { type: "array" } },
      type: "object",
    });
    for (const tool of tools.values()) {
      expect(tool.description.length).toBeGreaterThan(20);
      expect(() => JSON.stringify(tool.inputSchema)).not.toThrow();
    }
  });

  it("adds elements as one undo step, selected, and says so", async () => {
    const { call, elements, notify, store } = setup();
    const result = await call("add_elements", {
      elements: [
        {
          color: "#fff",
          outline: { color: "#000" },
          text: "WOW",
          type: "text",
        },
        { fill: "#f00", place: "top-left", type: "rect" },
        { graphic: "arrow", type: "graphic" },
        { source: "https://example.com/photo.png", type: "image", width: 300 },
      ],
    });
    expect(result.error).toBeUndefined();
    expect(elements().map((element) => element.type)).toEqual([
      "text",
      "rect",
      "graphic",
      "image",
    ]);
    // Centred on its measured height, which get_design reports too
    expect(elements()[0]?.y).toBeCloseTo((PAGE.height - MEASURED_HEIGHT) / 2);
    expect(result.added[0].height).toBe(MEASURED_HEIGHT);
    expect(store.getState().selectedIds).toHaveLength(4);
    expect(store.getState().assets.map((asset) => asset.id)).toContain(
      ASSET.id
    );
    expect(notify).toHaveBeenCalledWith("AI agent added 4 elements");

    store.getState().undo();
    expect(elements()).toHaveLength(0);
  });

  it("accepts arguments as a JSON string", async () => {
    const { call, elements } = setup();
    await call(
      "add_elements",
      JSON.stringify({ elements: [{ text: "Hi", type: "text" }] })
    );
    expect(elements()).toHaveLength(1);
  });

  it("reports bad input without changing anything", async () => {
    const { call, elements } = setup();
    const font = await call("add_elements", {
      elements: [
        { text: "ok", type: "text" },
        { font: "comic-sans", text: "x", type: "text" },
      ],
    });
    expect(font.error).toMatch(/Element 1 \(text\): Unknown font/u);
    const shape = await call("add_elements", { elements: [{ type: "blob" }] });
    expect(shape.error).toBeTruthy();
    expect(elements()).toHaveLength(0);
  });

  it("updates and reorders across pages in one undo step", async () => {
    const { call, elements, store } = setup();
    const first = await call("add_elements", {
      elements: [{ text: "A", type: "text" }, { type: "rect" }],
    });
    const page = await call("add_page", { background: { color: "#000" } });
    const second = await call("add_elements", {
      elements: [{ type: "ellipse" }],
      page_id: page.page_id,
    });
    const textId = first.added[0].id;
    const ellipseId = second.added[0].id;

    const result = await call("update_elements", {
      updates: [
        { id: textId, order: "front", set: { fill: "#ff0000", text: "B" } },
        { id: ellipseId, set: { fill: "#00ff00" } },
      ],
    });
    expect(result.error).toBeUndefined();
    const byId = new Map(elements().map((element) => [element.id, element]));
    expect(byId.get(textId)).toMatchObject({ fill: "#ff0000", text: "B" });
    expect(byId.get(ellipseId)).toMatchObject({ fill: "#00ff00" });
    const firstPage = store.getState().pages[0]?.doc.document.elements ?? [];
    expect(firstPage.at(-1)?.id).toBe(textId);

    store.getState().undo();
    const undone = new Map(elements().map((element) => [element.id, element]));
    expect(undone.get(textId)).toMatchObject({ text: "A" });
    expect(undone.get(ellipseId)).toMatchObject({ fill: "#ff3b30" });
  });

  it("refuses unknown fields and locked deletes", async () => {
    const { call, elements } = setup();
    const { added } = await call("add_elements", {
      elements: [{ advanced: { locked: true }, type: "rect" }],
    });
    const [{ id }] = added;
    const typo = await call("update_elements", {
      updates: [{ id, set: { colour: "red" } }],
    });
    expect(typo.error).toMatch(/Unknown field/u);
    const locked = await call("delete_elements", { ids: [id] });
    expect(locked.error).toMatch(/Locked/u);
    await call("update_elements", {
      updates: [{ id, set: { locked: false } }],
    });
    await call("delete_elements", { ids: [id] });
    expect(elements()).toHaveLength(0);
  });

  it("describes the design with pages, selection and backgrounds", async () => {
    const { call } = setup();
    await call("set_background", {
      background: { gradient: { colors: ["#000", "#fff"] } },
    });
    await call("add_elements", { elements: [{ text: "Hi", type: "text" }] });
    const design = await call("get_design");
    expect(design).toMatchObject({
      height: 720,
      name: "My thumbnail",
      width: 1280,
    });
    expect(design.pages[0].background.type).toBe("linear");
    expect(design.selectedIds).toHaveLength(1);
    expect(design.pages[0].elements[0]).toMatchObject({
      height: MEASURED_HEIGHT,
      text: "Hi",
    });
  });

  it("waits while the tab can't edit", async () => {
    const { call, store } = setup();
    store.getState().markOutdated();
    const result = await call("add_elements", {
      elements: [{ text: "x", type: "text" }],
    });
    expect(result.error).toMatch(/reload/u);
    // Reading still works
    const design = await call("get_design");
    expect(design.error).toBeUndefined();
  });

  it("waits while the magic eraser is open", async () => {
    const { call, elements, store } = setup();
    await call("add_elements", { elements: [{ type: "rect" }] });
    store.setState({ eraseTargetId: elements()[0]?.id ?? null });
    const undo = await call("undo");
    expect(undo.error).toMatch(/magic eraser/u);
    expect(elements()).toHaveLength(1);
  });

  it("previews as an image and downloads with a sensible name", async () => {
    const { call, download, elements, store } = setup();
    await call("add_elements", { elements: [{ text: "Hi", type: "text" }] });
    const [text] = elements();
    store.getState().setEditingText(text?.id ?? null);
    const preview = await call("get_preview");
    expect(preview).toMatchObject({ data: "AQID", type: "image" });
    // Looking doesn't end the person's typing
    expect(store.getState().editingTextId).toBe(text?.id);
    const result = await call("download", { format: "jpeg", scale: 2 });
    expect(result.downloaded).toBe("my-thumbnail-2560x1440.jpg");
    expect(download).toHaveBeenCalledOnce();
  });

  it("applies templates and undoes", async () => {
    const { call, elements } = setup();
    const missing = await call("apply_template", { template: "nope" });
    expect(missing.error).toMatch(/No template/u);
    await call("add_elements", { elements: [{ type: "rect" }] });
    await call("undo");
    expect(elements()).toHaveLength(0);
  });
});

const tool = (name: string): ModelContextTool => ({
  description: name,
  execute: () => name,
  name,
});

describe("registerTools", () => {
  it("prefers document.modelContext, then navigator's", () => {
    const native = { registerTool: vi.fn() };
    const legacy = { registerTool: vi.fn() };
    expect(
      modelContextOf({ modelContext: native }, { modelContext: legacy })
    ).toBe(native);
    expect(modelContextOf({}, { modelContext: legacy })).toBe(legacy);
    expect(modelContextOf({}, {})).toBeNull();
  });

  it("unregisters with the signal, or the handle older drafts return", async () => {
    const unregister = vi.fn();
    const context: ModelContext = {
      registerTool: vi.fn((item: ModelContextTool) => {
        if (item.name === "taken") {
          throw new Error("duplicate");
        }
        return item.name === "old" ? { unregister } : Promise.resolve();
      }),
    };
    const controller = new AbortController();
    const names = await registerTools(
      context,
      [tool("new"), tool("taken"), tool("old")],
      controller.signal
    );
    expect(names).toEqual(["new", "old"]);
    expect(context.registerTool).toHaveBeenCalledWith(expect.anything(), {
      signal: controller.signal,
    });
    controller.abort();
    expect(unregister).toHaveBeenCalledOnce();
  });
});
