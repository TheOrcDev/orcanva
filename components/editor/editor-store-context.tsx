"use client";

import { createContext, use } from "react";
import type { ReactNode } from "react";
import { useStore } from "zustand";

import type { EditorStore, EditorStoreApi } from "@/lib/editor/store";

const EditorStoreContext = createContext<EditorStoreApi | null>(null);

export const EditorStoreProvider = ({
  store,
  children,
}: {
  store: EditorStoreApi;
  children: ReactNode;
}) => <EditorStoreContext value={store}>{children}</EditorStoreContext>;

export const useEditorStoreApi = (): EditorStoreApi => {
  const store = use(EditorStoreContext);
  if (!store) {
    throw new Error(
      "useEditorStoreApi must be used inside EditorStoreProvider"
    );
  }
  return store;
};

export const useEditor = <T,>(selector: (state: EditorStore) => T): T =>
  useStore(useEditorStoreApi(), selector);
