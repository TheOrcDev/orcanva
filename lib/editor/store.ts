import { createStore } from "zustand/vanilla";

import {
  applyWrites,
  diffDocument,
  writesFor,
  writesOf,
} from "@/lib/collab/changeset";
import type { EditorDocument, Writes } from "@/lib/collab/changeset";
import type { SaveStatus } from "@/lib/collab/outbox";
import { assignPositions } from "@/lib/collab/positions";
import {
  EMPTY_PENDING,
  addNameWrite,
  addWrites,
  currentName,
  dropBatch,
  rebase,
  settleBatch,
  syncedFromDocument,
} from "@/lib/collab/sync-state";
import type {
  BatchSeqs,
  PendingWrites,
  SyncedState,
} from "@/lib/collab/sync-state";
import { createId } from "@/lib/document/factories";
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

export type { SaveStatus } from "@/lib/collab/outbox";

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
  // Identifies this editor session in writes and presence
  clientId: string;
  name: string;
  // The rendered document and each element's z-order key: the synced state
  // with this session's unconfirmed writes on top
  doc: EditorDocument;
  synced: SyncedState;
  pending: PendingWrites;
  // Counts local writes; also tells "I changed it" apart from remote edits
  seq: number;
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
  // A batch of writes reached the server (see lib/collab/outbox)
  settleWrites: (batch: BatchSeqs, promote: boolean) => void;
  // The server refused a batch: fall back to its version
  dropWrites: (batch: BatchSeqs) => void;
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

const NO_HELD = new Set<string>();

const clampZoom = (zoom: number) =>
  Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom));

// Drop selections that point at elements that no longer exist
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

// Queues a local edit's writes for the outbox
const queueWrites = (
  state: EditorState,
  writes: Writes
): Pick<EditorState, "pending" | "seq"> => {
  const seq = state.seq + 1;
  const existing = new Set(
    state.doc.document.elements.map((element) => element.id)
  );
  return { pending: addWrites(state.pending, writes, existing, seq), seq };
};

// Applies undo/redo/rollback writes and queues them
const applyLocal = (
  state: EditorState,
  writes: Writes
): Pick<EditorState, "doc" | "pending" | "seq" | "selectedIds"> => {
  const doc = applyWrites(state.doc, writes);
  return {
    ...queueWrites(state, writes),
    doc,
    selectedIds: keepExisting(state.selectedIds, doc.document),
  };
};

// Recomputes what's shown after the synced or pending state changed
const reconcile = (
  state: EditorState,
  synced: SyncedState,
  pending: PendingWrites
): Pick<
  EditorState,
  "doc" | "editingTextId" | "name" | "pending" | "selectedIds" | "synced"
> => {
  const doc = rebase(synced, pending, state.doc, NO_HELD);
  const editingGone =
    state.editingTextId !== null &&
    !doc.document.elements.some(
      (element) => element.id === state.editingTextId
    );
  return {
    doc,
    editingTextId: editingGone ? null : state.editingTextId,
    name: currentName(synced, pending),
    pending,
    selectedIds: keepExisting(state.selectedIds, doc.document),
    synced,
  };
};

export const createEditorStore = (init: EditorInit) => {
  const doc = initialDocument(init);

  return createStore<EditorStore>()((set) => ({
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
          ...queueWrites(state, writesOf(changes)),
          doc: editor,
          history: recordChange(state.history, changes),
          selectedIds: keepExisting(state.selectedIds, next),
        };
      }),
    clearSelection: () =>
      set((state) =>
        state.selectedIds.length === 0 ? state : { selectedIds: [] }
      ),
    clientId: createId(),
    designId: init.designId,
    doc,
    dropWrites: (batch) =>
      set((state) =>
        reconcile(state, state.synced, dropBatch(state.pending, batch))
      ),
    editingTextId: null,
    end: () => set((state) => ({ history: endTransaction(state.history) })),
    fileDragActive: false,
    history: createHistory(),
    name: init.name,
    pending: EMPTY_PENDING,
    redo: () =>
      set((state) => {
        const { history, step } = redo(state.history);
        if (!step) {
          return { editingTextId: null, fileDragActive: false, history };
        }
        return {
          ...applyLocal(state, writesFor(step, "redo", state.doc)),
          editingTextId: null,
          fileDragActive: false,
          history,
        };
      }),
    rename: (name) =>
      set((state) => ({
        name,
        pending: addNameWrite(state.pending, name, state.seq + 1),
        seq: state.seq + 1,
      })),
    rollback: () =>
      set((state) => {
        const { history, reverted } = cancelTransaction(state.history);
        if (!reverted) {
          return { history };
        }
        return {
          ...applyLocal(state, writesFor(reverted, "undo", state.doc)),
          history,
        };
      }),
    saveStatus: "saved",
    select: (ids) => set({ selectedIds: ids }),
    selectedIds: [],
    seq: 0,
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
    setSaveStatus: (status) =>
      set((state) =>
        state.saveStatus === status ? state : { saveStatus: status }
      ),
    setZoom: (zoom) => set({ zoom: clampZoom(zoom), zoomMode: "manual" }),
    settleWrites: (batch, promote) =>
      set((state) => {
        const settled = settleBatch(
          state.pending,
          state.synced,
          batch,
          promote
        );
        return reconcile(state, settled.synced, settled.pending);
      }),
    synced: syncedFromDocument(doc, init.name),
    undo: () =>
      set((state) => {
        const { history, step } = undo(state.history);
        if (!step) {
          return { editingTextId: null, fileDragActive: false, history };
        }
        return {
          ...applyLocal(state, writesFor(step, "undo", state.doc)),
          editingTextId: null,
          fileDragActive: false,
          history,
        };
      }),
    uploadsInFlight: 0,
    zoom: 1,
    zoomMode: "fit",
    zoomToFit: () => set({ zoomMode: "fit" }),
  }));
};

export type EditorStoreApi = ReturnType<typeof createEditorStore>;

export const selectDocument = (state: EditorStore): DesignDocument =>
  state.doc.document;
