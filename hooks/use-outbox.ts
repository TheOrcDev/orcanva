"use client";

import { useCallback, useEffect, useRef } from "react";

import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import { toast } from "@/components/ui/toast";
import {
  SaveError,
  createOutbox,
  sendChangesRequest,
} from "@/lib/collab/outbox";
import type { AwaitSync, Outbox } from "@/lib/collab/outbox";

const NOT_FOUND = 404;

// Sends this session's edits to the server as they happen (see
// lib/collab/outbox). Returns a flush for leaving the editor and a way to
// plug in the live queries' "has this transaction arrived" check.
export const useOutbox = (
  live: boolean
): {
  flush: () => Promise<void>;
  setAwaitSync: (awaitSync: AwaitSync | null) => void;
} => {
  const store = useEditorStoreApi();
  const outboxRef = useRef<Outbox | null>(null);
  const awaitSyncRef = useRef<AwaitSync | null>(null);

  useEffect(() => {
    const { clientId, designId } = store.getState();
    const outbox = createOutbox(
      {
        clientId,
        designId,
        drop: (batch) => store.getState().dropWrites(batch),
        echo: (txid) => store.getState().echoWrites(txid),
        getPending: () => store.getState().pending,
        live,
        onRefused: (error) => {
          // Made private or deleted while we were editing
          if (error instanceof SaveError && error.status === NOT_FOUND) {
            store.getState().loseAccess();
            return;
          }
          toast.add({
            description: "The server refused the change, so it was undone.",
            title: "Couldn't save a change",
            type: "error",
          });
        },
        setStatus: (status) => store.getState().setSaveStatus(status),
        settle: (batch, outcome, txid) =>
          store.getState().settleWrites(batch, outcome, txid),
      },
      sendChangesRequest
    );
    outbox.setAwaitSync(awaitSyncRef.current);
    outboxRef.current = outbox;

    const unsubscribe = store.subscribe((state, previous) => {
      if (state.seq !== previous.seq) {
        outbox.schedule();
      }
    });

    const handlePageHide = () => {
      outbox.flushOnExit();
    };
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (outbox.isDirty() && !outbox.flushOnExit()) {
        event.preventDefault();
      }
    };
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      unsubscribe();
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      outbox.flushOnExit();
      outbox.dispose();
      outboxRef.current = null;
    };
  }, [live, store]);

  const flush = useCallback(
    () => outboxRef.current?.flush() ?? Promise.resolve(),
    []
  );

  // Saving a version or restoring one sends this window's edits first
  useEffect(() => {
    store.getState().setFlushWrites(flush);
    return () => store.getState().setFlushWrites(null);
  }, [flush, store]);
  const setAwaitSync = useCallback(
    (awaitSync: AwaitSync | null) => {
      awaitSyncRef.current = awaitSync;
      outboxRef.current?.setAwaitSync(awaitSync);
      // A restore waits for its own transaction the same way
      store.getState().setAwaitEcho(awaitSync);
    },
    [store]
  );

  return { flush, setAwaitSync };
};
