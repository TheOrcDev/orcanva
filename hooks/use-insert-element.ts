"use client";

import { useCallback } from "react";

import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import type { Size } from "@/lib/document/geometry";
import type { DesignElement } from "@/lib/document/schema";
import { insertElement } from "@/lib/editor/document-ops";
import { selectDocument } from "@/lib/editor/store";

// Builds an element for the current page size, adds it on top, selects it
export const useInsertElement = () => {
  const store = useEditorStoreApi();
  return useCallback(
    (build: (page: Size) => DesignElement) => {
      const document = selectDocument(store.getState());
      const element = build({ height: document.height, width: document.width });
      store.getState().change((doc) => insertElement(doc, element));
      store.getState().select([element.id]);
      return element;
    },
    [store]
  );
};
