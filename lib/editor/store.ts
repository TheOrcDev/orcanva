import { createStore } from "zustand/vanilla";

import { applyWrites, diffDocument, writesFor } from "@/lib/collab/changeset";
import type { EditorDocument } from "@/lib/collab/changeset";
import { assignPositions } from "@/lib/collab/positions";
import type { DesignDocument } from "@/lib/document/schema";
import {
  beginTransaction,
  cancelTransaction,
  createHistory,
  endTransaction,
  recordChange,
  redo,
  undo,
} from "@/lib/editor/history";
import type { History } from "@/lib/editor/history";

export type SaveStatus = "saved" | "unsaved" | "saving" | "error";

export interface EditorAsset {
  id: string;
  url: string;
  width: number;
  height: number;
  name: string;
  // Set for derived images (e.g. a background-removed cutout)
  sourceAssetId: string | null;
}

export interface EditorState {
  designId: string;
  name: string;
  // The rendered document and each element's z-order key
  doc: EditorDocument;
  history: History;
  // Everything below is session UI state and never enters undo history
  selectedIds: string[];
  editingTextId: string | null;
  zoom: number;
  zoomMode: "fit" | "manual";
  saveStatus: SaveStatus;
  assets: EditorAsset[];
  uploadsInFlight: number;
  // Files are being dragged somewhere over the editor window
  fileDragActive: boolean;
  // Image elements with a background removal in progress
  backgroundJobs: string[];
}

export interface EditorActions {
  // Applies a document change; transient while a transaction is open
  change: (recipe: (document: DesignDocument) => DesignDocument) => void;
  begin: () => void;
  end: () => void;
  // Abandons the open transaction (e.g. Escape while typing)
  rollback: () => void;
  undo: () => void;
  redo: () => void;
  rename: (name: string) => void;
  select: (ids: string[]) => void;
  clearSelection: () => void;
  setEditingText: (id: string | null) => void;
  setZoom: (zoom: number) => void;
  // Fit mode recomputes zoom from the viewport without leaving fit mode
  setFitZoom: (zoom: number) => void;
  zoomToFit: () => void;
  setSaveStatus: (status: SaveStatus) => void;
  addAsset: (asset: EditorAsset) => void;
  adjustUploads: (delta: number) => void;
  setFileDragActive: (active: boolean) => void;
  setBackgroundJob: (elementId: string, running: boolean) => void;
}

export type EditorStore = EditorState & EditorActions;

export interface EditorInit {
  designId: string;
  name: string;
  document: DesignDocument;
  // Stored z-order keys by element id; generated when missing
  positions?: Record<string, string>;
  assets: EditorAsset[];
  hasThumbnail: boolean;
}

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 8;

const clampZoom = (zoom: number) =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

// Drop selections that point at elements an undo/redo just removed
const keepExisting = (ids: string[], document: DesignDocument): string[] => {
  const existing = new Set(document.elements.map((element) => element.id));
  const kept = ids.filter((id) => existing.has(id));
  return kept.length === ids.length ? ids : kept;
};

const initialDocument = (init: EditorInit): EditorDocument => {
  const ids = init.document.elements.map((element) => element.id);
  const stored = new Map(Object.entries(init.positions ?? {}));
  return {
    document: init.document,
    positions: assignPositions(stored, ids),
  };
};

export const createEditorStore = (init: EditorInit) =>
  createStore<EditorStore>()((set) => ({
    addAsset: (asset) =>
      set((state) =>
        state.assets.some((item) => item.id === asset.id)
          ? state
          : { assets: [asset, ...state.assets] }
      ),
    adjustUploads: (delta) =>
      set((state) => ({
        uploadsInFlight: Math.max(0, state.uploadsInFlight + delta),
      })),
    assets: init.assets,
    backgroundJobs: [],
    begin: () => set((state) => ({ history: beginTransaction(state.history) })),
    change: (recipe) =>
      set((state) => {
        const next = recipe(state.doc.document);
        if (next === state.doc.document) {
          return state;
        }
        const { changes, editor } = diffDocument(state.doc, next);
        return {
          doc: editor,
          history: recordChange(state.history, changes),
          selectedIds: keepExisting(state.selectedIds, next),
        };
      }),
    clearSelection: () =>
      set((state) =>
        state.selectedIds.length === 0 ? state : { selectedIds: [] }
      ),
    designId: init.designId,
    doc: initialDocument(init),
    editingTextId: null,
    end: () => set((state) => ({ history: endTransaction(state.history) })),
    fileDragActive: false,
    history: createHistory(),
    name: init.name,
    redo: () =>
      set((state) => {
        const { history, step } = redo(state.history);
        const doc = step
          ? applyWrites(state.doc, writesFor(step, "redo", state.doc))
          : state.doc;
        return {
          doc,
          editingTextId: null,
          fileDragActive: false,
          history,
          selectedIds: keepExisting(state.selectedIds, doc.document),
        };
      }),
    rename: (name) => set({ name }),
    rollback: () =>
      set((state) => {
        const { history, reverted } = cancelTransaction(state.history);
        const doc = reverted
          ? applyWrites(state.doc, writesFor(reverted, "undo", state.doc))
          : state.doc;
        return {
          doc,
          history,
          selectedIds: keepExisting(state.selectedIds, doc.document),
        };
      }),
    saveStatus: "saved",
    select: (ids) => set({ selectedIds: ids }),
    selectedIds: [],
    setBackgroundJob: (elementId, running) =>
      set((state) => {
        const has = state.backgroundJobs.includes(elementId);
        if (running === has) {
          return state;
        }
        return {
          backgroundJobs: running
            ? [...state.backgroundJobs, elementId]
            : state.backgroundJobs.filter((id) => id !== elementId),
        };
      }),
    setEditingText: (id) => set({ editingTextId: id }),
    setFileDragActive: (active) =>
      set((state) =>
        state.fileDragActive === active ? state : { fileDragActive: active }
      ),
    setFitZoom: (zoom) => set({ zoom: clampZoom(zoom) }),
    setSaveStatus: (status) => set({ saveStatus: status }),
    setZoom: (zoom) => set({ zoom: clampZoom(zoom), zoomMode: "manual" }),
    undo: () =>
      set((state) => {
        const { history, step } = undo(state.history);
        const doc = step
          ? applyWrites(state.doc, writesFor(step, "undo", state.doc))
          : state.doc;
        return {
          doc,
          editingTextId: null,
          fileDragActive: false,
          history,
          selectedIds: keepExisting(state.selectedIds, doc.document),
        };
      }),
    uploadsInFlight: 0,
    zoom: 1,
    zoomMode: "fit",
    zoomToFit: () => set({ zoomMode: "fit" }),
  }));

export type EditorStoreApi = ReturnType<typeof createEditorStore>;

export const selectDocument = (state: EditorStore): DesignDocument =>
  state.doc.document;
