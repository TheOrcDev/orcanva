"use client";

import { useCallback } from "react";

import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import type { DesignElement } from "@/lib/document/schema";
import { updateElement } from "@/lib/editor/document-ops";
import type { ElementPatch } from "@/lib/editor/document-ops";
import { selectDocument } from "@/lib/editor/store";

export const useSelectedElement = (): DesignElement | undefined =>
  useEditor((state) => {
    if (state.selectedIds.length !== 1) {
      return;
    }
    const [id] = state.selectedIds;
    return selectDocument(state).elements.find((element) => element.id === id);
  });

export const useUpdateElement = (id: string) => {
  const store = useEditorStoreApi();
  return useCallback(
    (patch: ElementPatch) => {
      store.getState().change((doc) => updateElement(doc, id, patch));
    },
    [store, id]
  );
};
