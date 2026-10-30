"use client";

import { useCallback, useEffect, useRef } from "react";

import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import { createAutosaver, sendSaveRequest } from "@/lib/editor/autosave";
import type { Autosaver } from "@/lib/editor/autosave";

// Debounced autosave of the document and name. Returns a flush function for
// leaving the editor (await it before navigating away).
export const useAutosave = (): (() => Promise<void>) => {
  const store = useEditorStoreApi();
  const saverRef = useRef<Autosaver | null>(null);

  useEffect(() => {
    const saver = createAutosaver(store, sendSaveRequest);
    saverRef.current = saver;

    const unsubscribe = store.subscribe((state, previous) => {
      const changed =
        state.history.present !== previous.history.present ||
        state.name !== previous.name;
      if (!changed || !saver.isDirty()) {
        return;
      }
      if (state.saveStatus !== "saving") {
        state.setSaveStatus("unsaved");
      }
      saver.schedule();
    });

    const handlePageHide = () => {
      saver.flushOnExit();
    };
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (saver.isDirty() && !saver.flushOnExit()) {
        event.preventDefault();
      }
    };
    window.addEventListener("pagehide", handlePageHide);
    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      unsubscribe();
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      saver.flushOnExit();
      saver.dispose();
      saverRef.current = null;
    };
  }, [store]);

  return useCallback(() => saverRef.current?.flush() ?? Promise.resolve(), []);
};
