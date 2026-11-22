"use client";

import { useCallback } from "react";

import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import { findElement, updateElement } from "@/lib/editor/document-ops";
import type { ElementPatch } from "@/lib/editor/document-ops";
import type { TextPatch } from "@/lib/text/fit";
import { fittedTextPatchInBrowser } from "@/lib/text/fit";

export const useUpdateElement = (id: string) => {
  const store = useEditorStoreApi();
  return useCallback(
    (patch: ElementPatch) => {
      store.getState().change((doc) => {
        const element = findElement(doc, id);
        if (element?.type === "text") {
          return updateElement(
            doc,
            id,
            fittedTextPatchInBrowser(element, patch as TextPatch)
          );
        }
        return updateElement(doc, id, patch);
      });
    },
    [store, id]
  );
};
