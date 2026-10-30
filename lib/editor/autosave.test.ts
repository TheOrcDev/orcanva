import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createBoxElement, createDocument } from "@/lib/document/factories";
import { createAutosaver } from "@/lib/editor/autosave";
import type { SavePayload } from "@/lib/editor/autosave";
import { insertElement } from "@/lib/editor/document-ops";
import { createEditorStore } from "@/lib/editor/store";

const PAGE = { height: 720, width: 1280 };

const setup = () =>
  createEditorStore({
    assets: [],
    designId: "d",
    document: createDocument(PAGE),
    name: "Test",
  });

const addRect = (store: ReturnType<typeof setup>) =>
  store
    .getState()
    .change((doc) => insertElement(doc, createBoxElement("rect", PAGE)));

describe("autosaver", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("debounces edits into one save", async () => {
    const store = setup();
    const send = vi.fn(() => Promise.resolve());
    const saver = createAutosaver(store, send, 1000);

    addRect(store);
    saver.schedule();
    addRect(store);
    saver.schedule();
    await vi.advanceTimersByTimeAsync(1000);

    expect(send).toHaveBeenCalledTimes(1);
    expect(store.getState().saveStatus).toBe("saved");
    expect(saver.isDirty()).toBe(false);
  });

  it("saves again when edits land during an in-flight save", async () => {
    const store = setup();
    const resolvers: (() => void)[] = [];
    const sent: SavePayload[] = [];
    const send = vi.fn((payload: SavePayload) => {
      const { promise, resolve } = Promise.withResolvers<undefined>();
      sent.push(payload);
      resolvers.push(() => resolve(undefined));
      return promise;
    });
    const saver = createAutosaver(store, send, 10);

    addRect(store);
    const first = saver.flush();
    expect(store.getState().saveStatus).toBe("saving");

    addRect(store);
    resolvers.shift()?.();
    await vi.advanceTimersByTimeAsync(0);
    expect(send).toHaveBeenCalledTimes(2);

    resolvers.shift()?.();
    await first;
    expect(sent.at(-1)?.document.elements).toHaveLength(2);
    expect(store.getState().saveStatus).toBe("saved");
  });

  it("reports errors and keeps the document dirty", async () => {
    const store = setup();
    const saver = createAutosaver(store, () => Promise.reject(new Error("x")));

    addRect(store);
    await saver.flush();

    expect(store.getState().saveStatus).toBe("error");
    expect(saver.isDirty()).toBe(true);
  });
});
