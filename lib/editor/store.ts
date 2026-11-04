import { createStore } from "zustand/vanilla";

import type { AssetVariant } from "@/lib/assets/variants";
import { keepsPrivateAccess } from "@/lib/auth/access";
import type { DesignRole, Visibility } from "@/lib/auth/access";
import type { BrandKit } from "@/lib/brand-kit/schema";
import {
  applyWrites,
  composePages,
  contentOf,
  diffDocument,
  pagesOfStep,
  writesFor,
  writesOf,
} from "@/lib/collab/changeset";
import type {
  ChangeSet,
  Direction,
  EditorDocument,
  PageView,
  Writes,
} from "@/lib/collab/changeset";
import { isDeepEqual } from "@/lib/collab/equal";
import {
  MAX_PROFILE_NAME,
  loadProfile,
  saveProfile,
} from "@/lib/collab/identity";
import type { Profile } from "@/lib/collab/identity";
import {
  entriesFromRows,
  isNewerDocument,
  pageFromRow,
  pagesFromRows,
  restoreFromRow,
} from "@/lib/collab/live-rows";
import type { AwaitSync, SaveStatus } from "@/lib/collab/outbox";
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
  syncedFrom,
} from "@/lib/collab/sync-state";
import type {
  BatchOutcome,
  BatchSeqs,
  PendingWrites,
  SyncedState,
} from "@/lib/collab/sync-state";
import { commentsFromRows, withEchoes } from "@/lib/comments/live-rows";
import type { CommentEcho, LiveCommentRow } from "@/lib/comments/live-rows";
import type {
  CommentPin,
  DesignComment,
  MentionPerson,
} from "@/lib/comments/schema";
import { createId } from "@/lib/document/factories";
import type { Rect } from "@/lib/document/geometry";
import {
  FIRST_PAGE_POSITION,
  WHITE_PAGE_BACKGROUND,
  sortPages,
} from "@/lib/document/pages";
import type { Background, DesignDocument } from "@/lib/document/schema";
import { cropDocument } from "@/lib/editor/document-ops";
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
import { fitRatio, fullPage, ratioValue } from "@/lib/editor/page-crop";
import type { PageCropRatio } from "@/lib/editor/page-crop";
import type { SnapGuide } from "@/lib/editor/snapping";
import type {
  LiveConfig,
  LiveElementRow,
  LivePageRow,
  LivePagesRow,
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
  // Set for derived images (a cutout, an erase, an upscale): the asset it was
  // made from, and how
  sourceAssetId: string | null;
  variant: AssetVariant | null;
}

// What an AI tool is doing to an image (see imageJobs)
export type ImageJob = "background" | "erase" | "upscale";

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
  // The viewer's brand kit; null for guests, who have none. Account data:
  // not part of the design or its undo history.
  brandKit: BrandKit | null;
  // The design went private or was deleted under us: stop and say so
  accessLost: boolean;
  // Newer code took over while this tab was open: the design's version went
  // past this tab's, or a deploy removed the Server Actions it calls. Its
  // edits are refused from then on, and it asks for a reload.
  outdated: boolean;
  // Identifies this editor session in writes and presence
  clientId: string;
  name: string;
  // Every page in order, each rendered as a document with its elements'
  // z-order keys: the synced state with this session's unconfirmed writes
  // on top
  pages: readonly PageView[];
  // The page on screen; session UI state, like the selection
  activePageId: string;
  // The page on screen as a document (the active page's), which the canvas
  // and panels work on
  doc: EditorDocument;
  synced: SyncedState;
  // Whether the design has page rows. Designs made by code from before
  // pages may have none: their one page is the design's id, with the
  // background the design row holds (`legacyBackground`).
  storedPages: boolean;
  legacyBackground: Background;
  pending: PendingWrites;
  // Counts local writes; also tells "I changed it" apart from remote edits
  seq: number;
  // Elements under a local drag or transform: remote updates wait for them
  held: ReadonlySet<string>;
  liveStatus: LiveStatus;
  // Element rows on the server this tab can't read, usually ones a newer
  // Orcanva wrote: they're left off the canvas until a reload
  skippedElementIds: readonly string[];
  // Re-subscribes the live queries after they stopped (set by the live sync)
  reconnectLive: (() => void) | null;
  // Sends this window's edits now and resolves once they reached the server
  // (set by the outbox), so a version saved next holds them
  flushWrites: (() => Promise<void>) | null;
  // Resolves once the live queries show a transaction (set while they're
  // live), so a restore can wait for its own echo
  awaitEcho: AwaitSync | null;
  // Draws and uploads the gallery preview now if the design changed (set by
  // the thumbnailer)
  flushThumbnail: (() => Promise<void>) | null;
  // How many times a version was restored over the design (restore_seq).
  // When it goes up, the undo history is for a design that's gone: cleared.
  restoreSeq: number;
  // The newest restore this window saw happen; `own` when this window made it
  lastRestore: { seq: number; byName: string | null; own: boolean } | null;
  // This window is restoring a version (see beginRestore)
  restoring: boolean;
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
  // The characters selected in the text being edited, kept while the
  // panel has focus so its controls can style them
  textSelection: { start: number; end: number } | null;
  // The image being cropped (one undo step from start to finish). The
  // workspace finishes the crop if someone deletes the image meanwhile.
  cropTargetId: string | null;
  // The image the magic eraser is open on. Its brush strokes and erases are
  // its own (lib/editor/magic-eraser.ts) and the document's undo waits;
  // Done swaps the photo in one step. Ends if the image is deleted.
  eraseTargetId: string | null;
  // The part of the page a page crop keeps (page coordinates), while the
  // page is cropped. The page only changes when it's applied.
  pageCrop: Rect | null;
  // The shape the page crop's box keeps
  pageCropRatio: PageCropRatio;
  // Lines shown while something snaps during a drag
  guides: SnapGuide[];
  // The frame a dragged photo would drop into
  dropTargetId: string | null;
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
  // Image elements an AI tool is working on, and which one; session state,
  // so other windows don't see it
  imageJobs: Readonly<Record<string, ImageJob>>;
  // The version history sheet is open
  historyOpen: boolean;
  // The version shown read-only in place of the workspace; editing goes on
  // underneath, but this window's keys and undo wait until it closes
  previewVersionId: string | null;
  // Comments on the design, threads and replies (see lib/comments). Kept
  // outside the document: they're never part of undo or a version.
  comments: readonly DesignComment[];
  // This window's own posts, edits and deletes, kept on top of live results
  // until the live query shows them
  commentEchoes: ReadonlyMap<string, CommentEcho>;
  // Clicks on the page place a comment's pin instead of selecting
  commentMode: boolean;
  // The thread whose popover is open
  openThreadId: string | null;
  // A new thread being written, and where its pin goes
  draftPin: CommentPin | null;
  // Asks the workspace to bring a thread's pin into view; `seq` counts the
  // asks, so asking again for the same thread pans again
  focusRequest: { threadId: string; seq: number } | null;
  // Who comments can mention, loaded the first time a composer needs it;
  // null until then
  mentionable: readonly MentionPerson[] | null;
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
  applyLivePages: (rows: readonly LivePagesRow[]) => void;
  // Shows another page (finishing crops and typing, dropping the selection)
  setActivePage: (id: string) => void;
  applyLiveComments: (rows: readonly LiveCommentRow[]) => void;
  setLiveStatus: (status: LiveStatus) => void;
  setReconnectLive: (reconnect: (() => void) | null) => void;
  setFlushWrites: (flush: (() => Promise<void>) | null) => void;
  setAwaitEcho: (awaitEcho: AwaitSync | null) => void;
  setFlushThumbnail: (flush: (() => Promise<void>) | null) => void;
  // A restore from this window starts / is done: restores seen meanwhile
  // are its own
  beginRestore: () => void;
  endRestore: () => void;
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
  setTextSelection: (selection: { start: number; end: number } | null) => void;
  startCrop: (id: string) => void;
  // Opens the magic eraser on an image (finishing a crop first), or closes it
  startErase: (id: string) => void;
  finishErase: () => void;
  // Keeps the crop, or puts the image back as it was
  finishCrop: (keep: boolean) => void;
  startPageCrop: () => void;
  setPageCrop: (box: Rect) => void;
  // Locks the box to a shape, refitting it to the page
  setPageCropRatio: (ratio: PageCropRatio) => void;
  // Crops the page to the box (one undo step), or leaves it as it was
  finishPageCrop: (keep: boolean) => void;
  setGuides: (guides: SnapGuide[]) => void;
  setDropTarget: (id: string | null) => void;
  setZoom: (zoom: number) => void;
  // Fit mode recomputes zoom from the viewport without leaving fit mode
  setFitZoom: (zoom: number) => void;
  zoomToFit: () => void;
  setSaveStatus: (status: SaveStatus) => void;
  // The server no longer lets this person at the design (404)
  loseAccess: () => void;
  // This tab's code is out of date (see `outdated`)
  markOutdated: () => void;
  // The owner changed who can see the design
  setVisibility: (visibility: Visibility) => void;
  // One of the viewer's own uploads (or cutouts): drawable and in the library
  addAsset: (asset: EditorAsset) => void;
  // Assets looked up after the editor opened (e.g. a collaborator's upload)
  addAssets: (assets: readonly EditorAsset[]) => void;
  markAssetsMissing: (ids: readonly string[]) => void;
  adjustUploads: (delta: number) => void;
  setFileDragActive: (active: boolean) => void;
  // An AI tool starts on an image, or stops with null
  setImageJob: (elementId: string, job: ImageJob | null) => void;
  // The brand kit as it should show; ignored for guests
  setBrandKit: (kit: BrandKit) => void;
  setHistoryOpen: (open: boolean) => void;
  // Shows a version read-only (finishing a crop or text edit first), or
  // goes back to editing with null
  previewVersion: (id: string | null) => void;
  // Comment mode on (finishing crops and typing, and clearing the
  // selection) or off (dropping a thread being written)
  setCommentMode: (on: boolean) => void;
  openThread: (id: string | null) => void;
  // Starts writing a new thread pinned there, or stops with null
  placeDraft: (pin: CommentPin | null) => void;
  // Esc: drops a thread being written, else closes the open thread, else
  // leaves comment mode. False when there was nothing to leave.
  leaveComments: () => boolean;
  // A comment this window posted or changed, shown before the live query
  // brings it
  upsertComment: (comment: DesignComment) => void;
  // A comment this window deleted (a thread takes its replies with it)
  removeComment: (id: string) => void;
  // Opens a thread and brings its pin into view (the Comments tab, a link)
  focusThread: (id: string) => void;
  setMentionable: (people: readonly MentionPerson[]) => void;
}

export type EditorStore = EditorState & EditorActions;

// One page as the server loaded it
export interface InitialPage {
  id: string;
  position: string;
  document: DesignDocument;
  // Stored z-order keys by element id; generated when missing
  positions?: Record<string, string>;
}

export interface EditorInit {
  designId: string;
  name: string;
  // The first page (and the only one without `pages`)
  document: DesignDocument;
  // Stored z-order keys by element id; generated when missing
  positions?: Record<string, string>;
  // Every page, in order; without it the design is `document`, one page
  // whose id is the design's
  pages?: InitialPage[];
  // Sealed live queries; null when Realtime isn't configured
  live?: LiveConfig | null;
  assets: EditorAsset[];
  libraryIds: string[];
  hasThumbnail: boolean;
  role: DesignRole;
  visibility: Visibility;
  viewer: EditorViewer | null;
  // The signed-in viewer's brand kit; null or missing for guests
  brandKit?: BrandKit | null;
  // designs.restore_seq when the page was loaded
  restoreSeq?: number;
  // The design's comments when the page was loaded
  comments?: DesignComment[];
  // The thread a link asked for (?comment=), opened from the start
  openThreadId?: string | null;
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

const pageViewOf = (page: InitialPage): PageView => {
  const ids = page.document.elements.map((element) => element.id);
  const stored = new Map(Object.entries(page.positions ?? {}));
  return {
    doc: {
      document: page.document,
      positions: assignPositions(stored, ids),
    },
    id: page.id,
    position: page.position,
  };
};

const initialPages = (init: EditorInit): PageView[] => {
  const pages =
    init.pages && init.pages.length > 0
      ? init.pages
      : [
          {
            document: init.document,
            id: init.designId,
            position: FIRST_PAGE_POSITION,
            positions: init.positions,
          },
        ];
  return pages.map(pageViewOf);
};

// The design's one page when nothing else is known: its id, the size and
// the background the design row holds
const legacyPage = (state: EditorState): PageView => ({
  doc: {
    document: {
      background: state.legacyBackground,
      elements: [],
      height: state.doc.document.height,
      version: state.doc.document.version,
      width: state.doc.document.width,
    },
    positions: new Map(),
  },
  id: state.designId,
  position: FIRST_PAGE_POSITION,
});

// Shows `pages`, staying on `wanted` (the active page by default). When
// that page is gone (someone deleted it), the page that took its place
// shows, or the last one.
const showPages = (
  state: EditorState,
  next: readonly PageView[],
  wanted: string = state.activePageId
): Pick<EditorState, "activePageId" | "doc" | "pages"> => {
  const pages = next.length > 0 ? next : [legacyPage(state)];
  const index = state.pages.findIndex((page) => page.id === wanted);
  const active =
    pages.find((page) => page.id === wanted) ??
    pages[Math.min(Math.max(index, 0), pages.length - 1)] ??
    legacyPage(state);
  return { activePageId: active.id, doc: active.doc, pages };
};

const activePage = (state: EditorState): PageView =>
  state.pages.find((page) => page.id === state.activePageId) ??
  legacyPage(state);

// The first page's id, where rows without a page are
const firstSyncedPage = (state: EditorState): string =>
  sortPages([...state.synced.pages].map(([id, page]) => ({ ...page, id })))[0]
    ?.id ?? state.designId;

// The page an undo or redo step should show: the one on screen if the step
// changed it, else the first page it changed that's still there
const pageForStep = (
  state: EditorState,
  pages: readonly PageView[],
  step: ChangeSet,
  direction: Direction
): string => {
  const touched = pagesOfStep(step, direction);
  if (touched.length === 0 || touched.includes(state.activePageId)) {
    return state.activePageId;
  }
  return (
    pages.find((page) => touched.includes(page.id))?.id ?? state.activePageId
  );
};

const visibilityFromRow = (row: LivePageRow, current: Visibility) =>
  row.visibility === "private" || row.visibility === "public"
    ? row.visibility
    : current;

// A version was restored over the design since this window last looked:
// its undo steps describe a design that's gone (and could be 500 elements
// big), so they're dropped. Edits still on their way stay.
const restoredFrom = (
  state: EditorState,
  row: LivePageRow
): Partial<Pick<EditorState, "history" | "lastRestore" | "restoreSeq">> => {
  const restore = restoreFromRow(row);
  if (!restore || restore.seq <= state.restoreSeq) {
    return {};
  }
  return {
    history: createHistory(),
    lastRestore: { ...restore, own: state.restoring },
    restoreSeq: restore.seq,
  };
};

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

// Signed in: the account's name in this browser's color. Guests: the
// random orc name this browser keeps.
const initialProfile = (viewer: EditorViewer | null): Profile => {
  const stored = loadProfile(browserStorage());
  const name = viewer?.name.trim().slice(0, MAX_PROFILE_NAME);
  return name ? { ...stored, name } : stored;
};

// Queues a local edit's writes for the outbox
const queueWrites = (
  state: EditorState,
  writes: Writes
): Pick<EditorState, "pending" | "seq"> => {
  const seq = state.seq + 1;
  const content = contentOf(state.pages);
  const existing = {
    elements: new Set(content.elements.keys()),
    pages: new Set(content.pages.keys()),
  };
  return { pending: addWrites(state.pending, writes, existing, seq), seq };
};

// Applies writes made here (an edit, undo, redo, rollback), shows them on
// `wanted` (the active page by default) and queues them
const applyLocal = (
  state: EditorState,
  writes: Writes,
  wanted?: (pages: readonly PageView[]) => string
): Pick<
  EditorState,
  "activePageId" | "doc" | "pages" | "pending" | "seq" | "selectedIds"
> => {
  const pages = composePages(
    applyWrites(contentOf(state.pages), writes),
    state.pages
  );
  const shown = showPages(state, pages, wanted?.(pages));
  return {
    ...queueWrites(state, writes),
    ...shown,
    selectedIds:
      shown.activePageId === state.activePageId
        ? keepExisting(state.selectedIds, shown.doc.document)
        : [],
  };
};

// Recomputes what's shown after the synced or pending state changed
const reconcile = (
  state: EditorState,
  synced: SyncedState,
  pending: PendingWrites
): Pick<
  EditorState,
  | "activePageId"
  | "doc"
  | "editingTextId"
  | "name"
  | "pages"
  | "pending"
  | "selectedIds"
  | "synced"
> => {
  const shown = showPages(
    state,
    rebase(synced, pending, state.pages, state.held)
  );
  const { document } = shown.doc;
  const exists = (id: string | null) =>
    id !== null && document.elements.some((element) => element.id === id);
  return {
    ...shown,
    editingTextId: exists(state.editingTextId) ? state.editingTextId : null,
    name: currentName(synced, pending),
    pending,
    selectedIds: keepExisting(state.selectedIds, document),
    synced,
  };
};

export const createEditorStore = (init: EditorInit) => {
  const opened = initialPages(init);
  const [first] = opened;
  if (!first) {
    throw new Error("A design has a page");
  }

  return createStore<EditorStore>()((set, get) => ({
    accessLost: false,
    activePageId: first.id,
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
    applyLiveComments: (rows) =>
      set((state) => {
        const live = commentsFromRows(rows, state.comments);
        const { comments, echoes } = withEchoes(
          live,
          state.commentEchoes,
          Date.now()
        );
        // Someone deleted the thread that's open here
        const openThreadId =
          state.openThreadId !== null &&
          comments.some((comment) => comment.id === state.openThreadId)
            ? state.openThreadId
            : null;
        return { commentEchoes: echoes, comments, openThreadId };
      }),
    applyLiveElements: (rows) =>
      set((state) => {
        const { entries, skipped } = entriesFromRows(
          rows,
          state.synced.elements,
          firstSyncedPage(state)
        );
        return {
          ...reconcile(
            state,
            { ...state.synced, elements: entries },
            state.pending
          ),
          skippedElementIds: isDeepEqual(skipped, state.skippedElementIds)
            ? state.skippedElementIds
            : skipped,
        };
      }),
    applyLivePage: (row) =>
      set((state) => {
        const visibility = visibilityFromRow(row, state.visibility);
        // Gone private: only the owner and people it's shared with may stay
        // (the server agrees on the next request, this just doesn't wait)
        const accessLost =
          state.accessLost ||
          (visibility === "private" && !keepsPrivateAccess(state.role));
        const outdated = state.outdated || isNewerDocument(row);
        const restored = restoredFrom(state, row);
        const { background, name, size } = pageFromRow(row);
        const legacyBackground = background ?? state.legacyBackground;
        // Without page rows, the design row's background is the page's
        const pages = state.storedPages
          ? state.synced.pages
          : new Map([
              [
                state.designId,
                {
                  background: legacyBackground,
                  position: FIRST_PAGE_POSITION,
                },
              ],
            ]);
        return {
          ...reconcile(
            state,
            { ...state.synced, name, pages, size },
            state.pending
          ),
          ...restored,
          accessLost,
          legacyBackground,
          outdated,
          visibility,
        };
      }),
    applyLivePages: (rows) =>
      set((state) => {
        const stored = pagesFromRows(
          rows,
          state.synced.pages,
          WHITE_PAGE_BACKGROUND
        );
        const storedPages = stored.size > 0;
        const pages = storedPages
          ? stored
          : new Map([
              [
                state.designId,
                {
                  background: state.legacyBackground,
                  position: FIRST_PAGE_POSITION,
                },
              ],
            ]);
        return {
          ...reconcile(state, { ...state.synced, pages }, state.pending),
          storedPages,
        };
      }),
    applyPresence: (rows) =>
      set((state) => ({ peers: nextPeers(state, rows), presenceRows: rows })),
    assets: init.assets,
    awaitEcho: null,
    begin: () => set((state) => ({ history: beginTransaction(state.history) })),
    beginRestore: () => set({ restoring: true }),
    brandKit: init.viewer ? (init.brandKit ?? null) : null,
    change: (recipe) =>
      set((state) => {
        if (state.outdated) {
          return state;
        }
        const next = recipe(state.doc.document);
        if (next === state.doc.document) {
          return state;
        }
        const { changes } = diffDocument(state.doc, next, activePage(state));
        return {
          ...applyLocal(state, writesOf(changes)),
          history: recordChange(state.history, changes),
        };
      }),
    clearSelection: () =>
      set((state) =>
        state.selectedIds.length === 0 ? state : { selectedIds: [] }
      ),
    clientId: createId(),
    commentEchoes: new Map(),
    commentMode: false,
    comments: init.comments ?? [],
    cropTargetId: null,
    designId: init.designId,
    doc: first.doc,
    draftPin: null,
    dragPreview: null,
    dropTargetId: null,
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
    endRestore: () => set({ restoring: false }),
    eraseTargetId: null,
    fileDragActive: false,
    finishCrop: (keep) => {
      const id = get().cropTargetId;
      if (!id) {
        return;
      }
      if (keep) {
        get().end();
      } else {
        get().rollback();
      }
      set({ cropTargetId: null });
      get().release([id]);
    },
    finishErase: () => {
      const id = get().eraseTargetId;
      if (!id) {
        return;
      }
      set({ eraseTargetId: null });
      get().release([id]);
    },
    finishPageCrop: (keep) => {
      const box = get().pageCrop;
      if (!box) {
        return;
      }
      set({ pageCrop: null });
      if (keep) {
        get().change((document) => cropDocument(document, box));
        get().zoomToFit();
      }
    },
    flushThumbnail: null,
    flushWrites: null,
    focusRequest: init.openThreadId
      ? { seq: 1, threadId: init.openThreadId }
      : null,
    focusThread: (id) =>
      set((state) => ({
        draftPin: null,
        focusRequest: { seq: (state.focusRequest?.seq ?? 0) + 1, threadId: id },
        openThreadId: id,
      })),
    guides: [],
    held: new Set(),
    history: createHistory(),
    historyOpen: false,
    hold: (ids) => set((state) => ({ held: new Set([...state.held, ...ids]) })),
    imageJobs: {},
    lastRestore: null,
    leaveComments: () => {
      const state = get();
      if (state.draftPin) {
        set({ draftPin: null });
        return true;
      }
      if (state.openThreadId) {
        set({ openThreadId: null });
        return true;
      }
      if (state.commentMode) {
        set({ commentMode: false });
        return true;
      }
      return false;
    },
    legacyBackground: first.doc.document.background,
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
    markOutdated: () =>
      set((state) => (state.outdated ? state : { outdated: true })),
    mentionable: null,
    missingAssetIds: [],
    name: init.name,
    openThread: (id) =>
      set((state) =>
        state.openThreadId === id && state.draftPin === null
          ? state
          : { draftPin: null, openThreadId: id }
      ),
    openThreadId: init.openThreadId ?? null,
    outdated: false,
    pageCrop: null,
    pageCropRatio: "free",
    pages: opened,
    peers: [],
    pending: EMPTY_PENDING,
    placeDraft: (pin) => set({ draftPin: pin, openThreadId: null }),
    pointer: null,
    presenceRows: [],
    previewVersion: (id) => {
      if (id !== null) {
        get().finishCrop(true);
        get().finishPageCrop(false);
        get().finishErase();
      }
      set(
        id === null
          ? { previewVersionId: null }
          : {
              editingTextId: null,
              historyOpen: false,
              previewVersionId: id,
              textSelection: null,
            }
      );
    },
    previewVersionId: null,
    profile: initialProfile(init.viewer),
    reconnectLive: null,
    redo: () =>
      set((state) => {
        if (state.outdated || state.previewVersionId || state.eraseTargetId) {
          return state;
        }
        const { history, step } = redo(state.history);
        if (!step) {
          return { editingTextId: null, fileDragActive: false, history };
        }
        return {
          ...applyLocal(
            state,
            writesFor(step, "redo", contentOf(state.pages)),
            (pages) => pageForStep(state, pages, step, "redo")
          ),
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
    removeComment: (id) =>
      set((state) => ({
        // Its replies went with it, waiting ones included
        commentEchoes: new Map(
          [...state.commentEchoes].filter(
            ([, echo]) => echo.comment?.threadId !== id
          )
        ).set(id, { at: Date.now(), comment: null }),
        comments: state.comments.filter(
          (comment) => comment.id !== id && comment.threadId !== id
        ),
        openThreadId: state.openThreadId === id ? null : state.openThreadId,
      })),
    rename: (name) =>
      set((state) =>
        state.outdated
          ? state
          : {
              name,
              pending: addNameWrite(state.pending, name, state.seq + 1),
              seq: state.seq + 1,
            }
      ),
    restoreSeq: init.restoreSeq ?? 0,
    restoring: false,
    role: init.role,
    rollback: () =>
      set((state) => {
        const { history, reverted } = cancelTransaction(state.history);
        if (!reverted || state.outdated) {
          return { history };
        }
        return {
          ...applyLocal(
            state,
            writesFor(reverted, "undo", contentOf(state.pages))
          ),
          history,
        };
      }),
    saveStatus: "saved",
    select: (ids) => set({ selectedIds: ids }),
    selectedIds: [],
    seq: 0,
    serverOffset: 0,
    setActivePage: (id) => {
      const state = get();
      if (
        id === state.activePageId ||
        !state.pages.some((page) => page.id === id)
      ) {
        return;
      }
      state.finishCrop(true);
      state.finishPageCrop(false);
      state.finishErase();
      // What was picked, pointed at or being written was on the other page
      set((current) => ({
        ...showPages(current, current.pages, id),
        draftPin: null,
        dragPreview: null,
        editingTextId: null,
        openThreadId: null,
        pointer: null,
        selectedIds: [],
        textSelection: null,
      }));
    },
    setAwaitEcho: (awaitEcho) => set({ awaitEcho }),
    setBrandKit: (kit) =>
      set((state) => {
        if (state.viewer === null || isDeepEqual(kit, state.brandKit)) {
          return state;
        }
        // A logo added in another tab may be an upload this one hasn't seen
        const known = new Set(state.assets.map((asset) => asset.id));
        const added = kit.logos.filter((logo) => !known.has(logo.id));
        return {
          assets: added.length > 0 ? [...state.assets, ...added] : state.assets,
          brandKit: kit,
        };
      }),
    setCommentMode: (on) => {
      if (on) {
        get().finishCrop(true);
        get().finishPageCrop(true);
        get().finishErase();
        set({ commentMode: true, editingTextId: null, selectedIds: [] });
      } else {
        set({ commentMode: false, draftPin: null });
      }
    },
    setDragPreview: (preview) => set({ dragPreview: preview }),
    setDropTarget: (id) =>
      set((state) =>
        state.dropTargetId === id ? state : { dropTargetId: id }
      ),
    setEditingText: (id) => set({ editingTextId: id, textSelection: null }),
    setFileDragActive: (active) =>
      set((state) =>
        state.fileDragActive === active ? state : { fileDragActive: active }
      ),
    setFitZoom: (zoom) => set({ zoom: clampZoom(zoom) }),
    setFlushThumbnail: (flush) => set({ flushThumbnail: flush }),
    setFlushWrites: (flush) => set({ flushWrites: flush }),
    setGuides: (guides) =>
      set((state) =>
        guides.length === 0 && state.guides.length === 0 ? state : { guides }
      ),
    setHistoryOpen: (open) =>
      set((state) =>
        state.historyOpen === open ? state : { historyOpen: open }
      ),
    setImageJob: (elementId, job) =>
      set((state) => {
        if ((state.imageJobs[elementId] ?? null) === job) {
          return state;
        }
        const { [elementId]: _done, ...others } = state.imageJobs;
        return { imageJobs: job ? { ...others, [elementId]: job } : others };
      }),
    setLiveStatus: (status) =>
      set((state) =>
        state.liveStatus === status ? state : { liveStatus: status }
      ),
    setMentionable: (people) => set({ mentionable: people }),
    setPageCrop: (box) => set({ pageCrop: box }),
    setPageCropRatio: (ratio) =>
      set((state) => {
        const page = state.doc.document;
        const value = ratioValue(ratio, page);
        return {
          pageCrop:
            state.pageCrop && value !== null
              ? fitRatio(state.pageCrop, value, page)
              : state.pageCrop,
          pageCropRatio: ratio,
        };
      }),
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
      // A signed-in name belongs to the account; this browser keeps the
      // color, and the guest name for when nobody is signed in
      const stored = init.viewer
        ? { ...loadProfile(browserStorage()), color: profile.color }
        : profile;
      saveProfile(browserStorage(), stored);
      set({ profile });
    },
    setReconnectLive: (reconnect) => set({ reconnectLive: reconnect }),
    setSaveStatus: (status) =>
      set((state) =>
        state.saveStatus === status ? state : { saveStatus: status }
      ),
    setServerOffset: (offset) => set({ serverOffset: offset }),
    setTextSelection: (selection) =>
      set((state) =>
        state.textSelection?.start === selection?.start &&
        state.textSelection?.end === selection?.end
          ? state
          : { textSelection: selection }
      ),
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
    skippedElementIds: [],
    startCrop: (id) => {
      get().finishErase();
      set((state) => ({
        cropTargetId: id,
        editingTextId: null,
        held: new Set([...state.held, id]),
        history: beginTransaction(state.history),
        selectedIds: [id],
      }));
    },
    // Held like a crop, so remote edits wait instead of moving the photo
    // under the brush
    startErase: (id) => {
      get().finishCrop(true);
      get().finishPageCrop(false);
      set((state) => ({
        commentMode: false,
        editingTextId: null,
        eraseTargetId: id,
        held: new Set([...state.held, id]),
        selectedIds: [id],
      }));
    },
    startPageCrop: () => {
      get().finishCrop(true);
      get().finishErase();
      set((state) => ({
        editingTextId: null,
        pageCrop: fullPage(state.doc.document),
        pageCropRatio: "free",
        selectedIds: [],
      }));
    },
    storedPages: true,
    synced: syncedFrom(contentOf(opened), init.name),
    textSelection: null,
    undo: () =>
      set((state) => {
        if (state.outdated || state.previewVersionId || state.eraseTargetId) {
          return state;
        }
        const { history, step } = undo(state.history);
        if (!step) {
          return { editingTextId: null, fileDragActive: false, history };
        }
        return {
          ...applyLocal(
            state,
            writesFor(step, "undo", contentOf(state.pages)),
            (pages) => pageForStep(state, pages, step, "undo")
          ),
          editingTextId: null,
          fileDragActive: false,
          history,
        };
      }),
    uploadsInFlight: 0,
    upsertComment: (comment) =>
      set((state) => {
        const index = state.comments.findIndex(
          (item) => item.id === comment.id
        );
        return {
          commentEchoes: new Map(state.commentEchoes).set(comment.id, {
            at: Date.now(),
            comment,
          }),
          comments:
            index === -1
              ? [...state.comments, comment]
              : state.comments.with(index, comment),
        };
      }),
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

// The page on screen with every page's elements: for what looks at the
// whole design (its images, its colours), not for drawing
export const selectWholeDesign = (state: EditorStore): DesignDocument => ({
  ...state.doc.document,
  elements: state.pages.flatMap((page) => page.doc.document.elements),
});
