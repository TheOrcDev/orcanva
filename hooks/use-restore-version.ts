"use client";

import { useCallback, useEffect } from "react";

import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { toast } from "@/components/ui/toast";
import type { EditorStoreApi } from "@/lib/editor/store";
import { requestRestore } from "@/lib/versions/api";

// How long a restore waits to see itself on the live queries
const ECHO_TIMEOUT_MS = 10_000;

// Resolves once the live page row shows a restore newer than `seq`, or
// after the timeout (the live queries are reconnecting, say)
const restoreSeen = (store: EditorStoreApi, seq: number): Promise<void> => {
  if (store.getState().restoreSeq > seq) {
    return Promise.resolve();
  }
  const { promise, resolve } = Promise.withResolvers<undefined>();
  const unsubscribe = store.subscribe((state) => {
    if (state.restoreSeq > seq) {
      resolve(undefined);
    }
  });
  const timer = setTimeout(() => resolve(undefined), ECHO_TIMEOUT_MS);
  return promise.finally(() => {
    clearTimeout(timer);
    unsubscribe();
  });
};

// Restores a version from this window: its own edits go out first, then
// it waits until the live queries show the restored design, closes the
// preview and offers Undo restore, which restores the version this restore
// made of the state it replaced. Without Realtime the page reloads.
const restoreIn = async (
  store: EditorStoreApi,
  versionId: string
): Promise<void> => {
  const start = store.getState();
  if (start.restoring || start.outdated) {
    return;
  }
  start.beginRestore();
  try {
    await start.flushWrites?.();
    const { restoreVersionId, txid } = await requestRestore(
      start.designId,
      versionId,
      start.clientId
    );
    if (store.getState().liveStatus === "off") {
      window.location.reload();
      return;
    }
    const { awaitEcho } = store.getState();
    await Promise.all([
      awaitEcho?.(txid, { elements: true, page: true }).catch(() => null),
      restoreSeen(store, start.restoreSeq),
    ]);
    store.getState().previewVersion(null);
    store.getState().zoomToFit();
    const id = toast.add({
      actionProps: {
        children: "Undo restore",
        onClick: () => {
          toast.close(id);
          restoreIn(store, restoreVersionId).catch(() => null);
        },
      },
      description:
        "Everyone on the design sees it now. Undo history was cleared.",
      timeout: 15_000,
      title: "Version restored",
      type: "success",
    });
    // The gallery preview shows the restored design
    store
      .getState()
      .flushThumbnail?.()
      .catch(() => null);
  } catch (error) {
    toast.add({
      description: error instanceof Error ? error.message : undefined,
      title: "Couldn't restore this version",
      type: "error",
    });
  }
  store.getState().endRestore();
};

// Restores versions from this window; `restoring` while one is under way
export const useRestoreVersion = (): {
  restore: (versionId: string) => Promise<void>;
  restoring: boolean;
} => {
  const store = useEditorStoreApi();
  const restoring = useEditor((state) => state.restoring);
  const restore = useCallback(
    (versionId: string) => restoreIn(store, versionId),
    [store]
  );
  return { restore, restoring };
};

// Tells everyone else on the design when someone restores a version: their
// canvas changes under them, and their undo history is gone
export const useRestoreNotice = () => {
  const store = useEditorStoreApi();

  useEffect(
    () =>
      store.subscribe((state, previous) => {
        const restore = state.lastRestore;
        if (!restore || restore === previous.lastRestore || restore.own) {
          return;
        }
        toast.add({
          description:
            "Your undo history was cleared, since it was for the design before.",
          title: `${restore.byName ?? "Someone"} restored an earlier version`,
          type: "info",
        });
      }),
    [store]
  );
};
