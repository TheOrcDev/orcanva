import type { DesignDocument } from "@/lib/document/schema";
import type { EditorStoreApi } from "@/lib/editor/store";

export const SAVE_DEBOUNCE_MS = 1000;

export interface SavePayload {
  designId: string;
  document: DesignDocument;
  name: string;
}

export type SendSave = (
  payload: SavePayload,
  options: { keepalive: boolean }
) => Promise<void>;

export interface Autosaver {
  isDirty: () => boolean;
  schedule: () => void;
  // Saves now (waiting for any in-flight save) and resolves when settled
  flush: () => Promise<void>;
  // Best-effort save for tab close; false when it could not be sent
  flushOnExit: () => boolean;
  dispose: () => void;
}

// One save in flight at a time; edits made meanwhile trigger one more save.
export const createAutosaver = (
  store: EditorStoreApi,
  send: SendSave,
  debounceMs = SAVE_DEBOUNCE_MS
): Autosaver => {
  let lastSavedDocument = store.getState().doc.document;
  let lastSavedName = store.getState().name;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let inFlight: Promise<void> | null = null;
  let disposed = false;

  const setStatus = store.getState().setSaveStatus;

  const isDirty = () => {
    const state = store.getState();
    return (
      state.doc.document !== lastSavedDocument || state.name !== lastSavedName
    );
  };

  const snapshot = (): SavePayload => {
    const state = store.getState();
    return {
      designId: state.designId,
      document: state.doc.document,
      name: state.name,
    };
  };

  const markSaved = (payload: SavePayload) => {
    lastSavedDocument = payload.document;
    lastSavedName = payload.name;
  };

  const run = async (): Promise<void> => {
    clearTimeout(timer);
    if (inFlight) {
      await inFlight;
      return run();
    }
    if (!isDirty()) {
      setStatus("saved");
      return;
    }

    const payload = snapshot();
    setStatus("saving");
    inFlight = send(payload, { keepalive: false });
    try {
      await inFlight;
      markSaved(payload);
    } catch {
      setStatus("error");
      return;
    } finally {
      inFlight = null;
    }

    if (isDirty()) {
      return run();
    }
    setStatus("saved");
  };

  const schedule = () => {
    if (disposed) {
      return;
    }
    clearTimeout(timer);
    timer = setTimeout(() => {
      run().catch(() => setStatus("error"));
    }, debounceMs);
  };

  const flushOnExit = () => {
    if (!isDirty()) {
      return true;
    }
    const payload = snapshot();
    try {
      send(payload, { keepalive: true })
        .then(() => markSaved(payload))
        .catch(() => setStatus("error"));
      return true;
    } catch {
      return false;
    }
  };

  const dispose = () => {
    disposed = true;
    clearTimeout(timer);
  };

  return { dispose, flush: run, flushOnExit, isDirty, schedule };
};

// Browsers cap keepalive request bodies at 64 KiB in total
const KEEPALIVE_BODY_LIMIT = 60_000;

const putDesign = async (
  designId: string,
  body: string,
  keepalive: boolean
): Promise<void> => {
  const response = await fetch(`/api/designs/${designId}`, {
    body,
    headers: { "Content-Type": "application/json" },
    keepalive,
    method: "PUT",
  });
  if (!response.ok) {
    throw new Error(`Save failed with ${response.status}`);
  }
};

// Throws synchronously when a tab-close save cannot fit in keepalive, so
// flushOnExit can tell the page to warn before unloading
export const sendSaveRequest: SendSave = (payload, { keepalive }) => {
  const body = JSON.stringify({
    document: payload.document,
    name: payload.name,
  });
  if (keepalive && body.length > KEEPALIVE_BODY_LIMIT) {
    throw new Error("Design is too large to save while closing the tab");
  }
  return putDesign(payload.designId, body, keepalive);
};
