"use client";

import { useCallback } from "react";

import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import { updateElement } from "@/lib/editor/document-ops";
import type { ElementPatch } from "@/lib/editor/document-ops";

export const useUpdateElement = (id: string) => {
  const store = useEditorStoreApi();
  return useCallback(
    (patch: ElementPatch) => {
      store.getState().change((doc) => updateElement(doc, id, patch));
    },
    [store, id]
  );
};
