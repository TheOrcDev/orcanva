import { createStore } from "zustand/vanilla";

import type { DesignRole, Visibility } from "@/lib/auth/access";
import {
  applyWrites,
  diffDocument,
  writesFor,
  writesOf,
} from "@/lib/collab/changeset";
import type { EditorDocument, Writes } from "@/lib/collab/changeset";
import { isDeepEqual } from "@/lib/collab/equal";
import { loadProfile, saveProfile } from "@/lib/collab/identity";
import type { Profile } from "@/lib/collab/identity";
import { entriesFromRows, pageFromRow } from "@/lib/collab/live-rows";
import type { SaveStatus } from "@/lib/collab/outbox";
import { assignPositions } from "@/lib/collab/positions";
import { peersFromRows } from "@/lib/collab/presence";
import type { DragPreview, LivePresenceRow, Peer } from "@/lib/collab/presence";
import {
  EMPTY_PENDING,
  addNameWrite,
  addWrites,
  currentName,
  dropBatch,
  echoTransaction,
  rebase,
  settleBatch,
  syncedFromDocument,
} from "@/lib/collab/sync-state";
import type {
  BatchOutcome,
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
import type {
  LiveConfig,
  LiveElementRow,
  LivePageRow,
} from "@/lib/realtime/rows";

export type { SaveStatus } from "@/lib/collab/outbox";

// "off" when Realtime isn't configured; otherwise the live queries' state
export type LiveStatus = "off" | "connecting" | "live" | "stale" | "error";

export interface EditorAsset {
  id: string;
  url: string;
  width: number;
  height: number;
  name: string;
  // Set for derived images (e.g. a background-removed cutout)
  sourceAssetId: string | null;
}

// The signed-in person using the editor
export interface EditorViewer {
  id: string;
  name: string;
  image: string | null;
}

export interface EditorState {
  designId: string;
  // What this person may do here: an editor can't rename the design
  role: DesignRole;
  visibility: Visibility;
  viewer: EditorViewer | null;
  // The design went private or was deleted under us: stop and say so
  accessLost: boolean;
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
  // Elements under a local drag or transform: remote updates wait for them
  held: ReadonlySet<string>;
  liveStatus: LiveStatus;
  // Re-subscribes the live queries after they stopped (set by the live sync)
  reconnectLive: (() => void) | null;
  // How this session shows up to others, and what it tells them
  profile: Profile;
  pointer: { x: number; y: number } | null;
  dragPreview: DragPreview | null;
  // Everyone else on the design right now
  peers: Peer[];
  presenceRows: readonly LivePresenceRow[];
  // Server clock minus this browser's, for judging how fresh presence is
  serverOffset: number;
  history: History;
  // Everything below is session UI state and never enters undo history
  selectedIds: string[];
  editingTextId: string | null;
  zoom: number;
  zoomMode: "fit" | "manual";
  saveStatus: SaveStatus;
  // Every asset the editor can draw: the viewer's library, what the design
  // shows, and anything looked up since
  assets: EditorAsset[];
  // The viewer's own uploads, newest first (the Uploads panel)
  libraryIds: string[];
  // Assets images point at that the server doesn't have (drawn in red)
  missingAssetIds: string[];
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
  settleWrites: (batch: BatchSeqs, outcome: BatchOutcome, txid: string) => void;
  // The live queries have applied one of our transactions
  echoWrites: (txid: string) => void;
  // The server refused a batch: fall back to its version
  dropWrites: (batch: BatchSeqs) => void;
  // New results from the live queries
  applyLiveElements: (rows: readonly LiveElementRow[]) => void;
  applyLivePage: (row: LivePageRow) => void;
  setLiveStatus: (status: LiveStatus) => void;
  setReconnectLive: (reconnect: (() => void) | null) => void;
  // A gesture on these elements started / ended
  hold: (ids: string[]) => void;
  release: (ids: string[]) => void;
  setProfile: (profile: Profile) => void;
  // Pointer position in page coordinates (null when off the canvas)
  setPointer: (point: { x: number; y: number } | null) => void;
  setDragPreview: (preview: DragPreview | null) => void;
  applyPresence: (rows: readonly LivePresenceRow[]) => void;
  // Re-checks who is still around (people time out without new rows)
  refreshPeers: () => void;
  setServerOffset: (offset: number) => void;
  select: (ids: string[]) => void;
  clearSelection: () => void;
  setEditingText: (id: string | null) => void;
  setZoom: (zoom: number) => void;
  // Fit mode recomputes zoom from the viewport without leaving fit mode
  setFitZoom: (zoom: number) => void;
  zoomToFit: () => void;
  setSaveStatus: (status: SaveStatus) => void;
  // The server no longer lets this person at the design (404)
  loseAccess: () => void;
  // The owner changed who can see the design
  setVisibility: (visibility: Visibility) => void;
  // One of the viewer's own uploads (or cutouts): drawable and in the library
  addAsset: (asset: EditorAsset) => void;
  // Assets looked up after the editor opened (e.g. a collaborator's upload)
  addAssets: (assets: readonly EditorAsset[]) => void;
  markAssetsMissing: (ids: readonly string[]) => void;
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
  // Sealed live queries; null when Realtime isn't configured
  live?: LiveConfig | null;
  assets: EditorAsset[];
  libraryIds: string[];
  hasThumbnail: boolean;
  role: DesignRole;
  visibility: Visibility;
  viewer: EditorViewer | null;
}

export const MIN_ZOOM = 0.05;
export const MAX_ZOOM = 8;

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

const visibilityFromRow = (row: LivePageRow, current: Visibility) =>
  row.visibility === "private" || row.visibility === "public"
    ? row.visibility
    : current;

// Keeps the previous array when nothing changed, so cursors don't re-render
const nextPeers = (state: EditorState, rows: readonly LivePresenceRow[]) => {
  const peers = peersFromRows(
    rows,
    state.clientId,
    Date.now() + state.serverOffset
  );
  return isDeepEqual(peers, state.peers) ? state.peers : peers;
};

const browserStorage = (): Storage | undefined =>
  typeof window === "undefined" ? undefined : window.localStorage;

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
  const doc = rebase(synced, pending, state.doc, state.held);
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
    accessLost: false,
    addAsset: (asset) =>
      set((state) => {
        const known = state.assets.some((item) => item.id === asset.id);
        const inLibrary = state.libraryIds.includes(asset.id);
        if (known && inLibrary) {
          return state;
        }
        return {
          assets: known ? state.assets : [asset, ...state.assets],
          libraryIds: inLibrary
            ? state.libraryIds
            : [asset.id, ...state.libraryIds],
        };
      }),
    addAssets: (assets) =>
      set((state) => {
        const known = new Set(state.assets.map((item) => item.id));
        const added = assets.filter((asset) => !known.has(asset.id));
        return added.length === 0
          ? state
          : { assets: [...state.assets, ...added] };
      }),
    adjustUploads: (delta) =>
      set((state) => ({
        uploadsInFlight: Math.max(0, state.uploadsInFlight + delta),
      })),
    applyLiveElements: (rows) =>
      set((state) => {
        const elements = entriesFromRows(rows, state.synced.elements);
        return reconcile(state, { ...state.synced, elements }, state.pending);
      }),
    applyLivePage: (row) =>
      set((state) => {
        const visibility = visibilityFromRow(row, state.visibility);
        // Gone private: only the owner may stay (the server agrees on the
        // next request, this just doesn't wait for it)
        const accessLost =
          state.accessLost ||
          (visibility === "private" && state.role !== "owner");
        const live = pageFromRow(row);
        if (!live) {
          return { accessLost, visibility };
        }
        return {
          ...reconcile(state, { ...state.synced, ...live }, state.pending),
          accessLost,
          visibility,
        };
      }),
    applyPresence: (rows) =>
      set((state) => ({ peers: nextPeers(state, rows), presenceRows: rows })),
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
    dragPreview: null,
    dropWrites: (batch) =>
      set((state) =>
        reconcile(state, state.synced, dropBatch(state.pending, batch))
      ),
    echoWrites: (txid) =>
      set((state) =>
        reconcile(state, state.synced, echoTransaction(state.pending, txid))
      ),
    editingTextId: null,
    end: () => set((state) => ({ history: endTransaction(state.history) })),
    fileDragActive: false,
    held: new Set(),
    history: createHistory(),
    hold: (ids) => set((state) => ({ held: new Set([...state.held, ...ids]) })),
    libraryIds: init.libraryIds,
    liveStatus: init.live ? "connecting" : "off",
    loseAccess: () =>
      set((state) => (state.accessLost ? state : { accessLost: true })),
    markAssetsMissing: (ids) =>
      set((state) => {
        const added = ids.filter((id) => !state.missingAssetIds.includes(id));
        return added.length === 0
          ? state
          : { missingAssetIds: [...state.missingAssetIds, ...added] };
      }),
    missingAssetIds: [],
    name: init.name,
    peers: [],
    pending: EMPTY_PENDING,
    pointer: null,
    presenceRows: [],
    profile: loadProfile(browserStorage()),
    reconnectLive: null,
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
    refreshPeers: () =>
      set((state) => {
        const peers = nextPeers(state, state.presenceRows);
        return peers === state.peers ? state : { peers };
      }),
    release: (ids) =>
      set((state) => {
        const held = new Set(state.held);
        for (const id of ids) {
          held.delete(id);
        }
        // Catch up on anything that arrived during the gesture
        return {
          ...reconcile({ ...state, held }, state.synced, state.pending),
          held,
        };
      }),
    rename: (name) =>
      set((state) => ({
        name,
        pending: addNameWrite(state.pending, name, state.seq + 1),
        seq: state.seq + 1,
      })),
    role: init.role,
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
    serverOffset: 0,
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
    setDragPreview: (preview) => set({ dragPreview: preview }),
    setEditingText: (id) => set({ editingTextId: id }),
    setFileDragActive: (active) =>
      set((state) =>
        state.fileDragActive === active ? state : { fileDragActive: active }
      ),
    setFitZoom: (zoom) => set({ zoom: clampZoom(zoom) }),
    setLiveStatus: (status) =>
      set((state) =>
        state.liveStatus === status ? state : { liveStatus: status }
      ),
    setPointer: (point) =>
      set((state) => {
        const same =
          point === state.pointer ||
          (point !== null &&
            state.pointer !== null &&
            point.x === state.pointer.x &&
            point.y === state.pointer.y);
        return same ? state : { pointer: point };
      }),
    setProfile: (profile) => {
      saveProfile(browserStorage(), profile);
      set({ profile });
    },
    setReconnectLive: (reconnect) => set({ reconnectLive: reconnect }),
    setSaveStatus: (status) =>
      set((state) =>
        state.saveStatus === status ? state : { saveStatus: status }
      ),
    setServerOffset: (offset) => set({ serverOffset: offset }),
    setVisibility: (visibility) =>
      set((state) =>
        state.visibility === visibility ? state : { visibility }
      ),
    setZoom: (zoom) => set({ zoom: clampZoom(zoom), zoomMode: "manual" }),
    settleWrites: (batch, outcome, txid) =>
      set((state) => {
        const settled = settleBatch(
          state.pending,
          state.synced,
          batch,
          outcome,
          txid
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
    viewer: init.viewer,
    visibility: init.visibility,
    zoom: 1,
    zoomMode: "fit",
    zoomToFit: () => set({ zoomMode: "fit" }),
  }));
};

export type EditorStoreApi = ReturnType<typeof createEditorStore>;

export const selectDocument = (state: EditorStore): DesignDocument =>
  state.doc.document;
