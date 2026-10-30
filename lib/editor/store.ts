import { createStore } from "zustand/vanilla";

import type { DesignDocument } from "@/lib/document/schema";
import {
  applyChange,
  beginTransaction,
  cancelTransaction,
  createHistory,
  endTransaction,
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
}

export interface EditorState {
  designId: string;
  name: string;
  history: History<DesignDocument>;
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
}

export type EditorStore = EditorState & EditorActions;

export interface EditorInit {
  designId: string;
  name: string;
  document: DesignDocument;
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
    begin: () => set((state) => ({ history: beginTransaction(state.history) })),
    change: (recipe) =>
      set((state) => {
        const next = recipe(state.history.present);
        if (next === state.history.present) {
          return state;
        }
        return {
          history: applyChange(state.history, next),
          selectedIds: keepExisting(state.selectedIds, next),
        };
      }),
    clearSelection: () =>
      set((state) =>
        state.selectedIds.length === 0 ? state : { selectedIds: [] }
      ),
    designId: init.designId,
    editingTextId: null,
    end: () => set((state) => ({ history: endTransaction(state.history) })),
    fileDragActive: false,
    history: createHistory(init.document),
    name: init.name,
    redo: () =>
      set((state) => {
        const history = redo(state.history);
        return {
          editingTextId: null,
          fileDragActive: false,
          history,
          selectedIds: keepExisting(state.selectedIds, history.present),
        };
      }),
    rename: (name) => set({ name }),
    rollback: () =>
      set((state) => {
        const history = cancelTransaction(state.history);
        return {
          history,
          selectedIds: keepExisting(state.selectedIds, history.present),
        };
      }),
    saveStatus: "saved",
    select: (ids) => set({ selectedIds: ids }),
    selectedIds: [],
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
        const history = undo(state.history);
        return {
          editingTextId: null,
          fileDragActive: false,
          history,
          selectedIds: keepExisting(state.selectedIds, history.present),
        };
      }),
    uploadsInFlight: 0,
    zoom: 1,
    zoomMode: "fit",
    zoomToFit: () => set({ zoomMode: "fit" }),
  }));

export type EditorStoreApi = ReturnType<typeof createEditorStore>;

export const selectDocument = (state: EditorStore): DesignDocument =>
  state.history.present;
