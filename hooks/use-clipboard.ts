"use client";

import { useEffect } from "react";

import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import { isTypingTarget } from "@/hooks/use-editor-shortcuts";
import { useUpload } from "@/hooks/use-upload";
import {
  parseClipboardElements,
  preparePastedElements,
  serializeElements,
} from "@/lib/editor/clipboard";
import { appendElements, removeElements } from "@/lib/editor/document-ops";
import { selectDocument } from "@/lib/editor/store";

// ⌘C/⌘X/⌘V for canvas elements via the system clipboard, plus pasting
// images (e.g. screenshots) which upload and land on the canvas
export const useClipboard = () => {
  const store = useEditorStoreApi();
  const upload = useUpload();

  useEffect(() => {
    const selectedElements = () => {
      const state = store.getState();
      const selected = new Set(state.selectedIds);
      return selectDocument(state).elements.filter((element) =>
        selected.has(element.id)
      );
    };

    const handleCopy = (event: ClipboardEvent) => {
      if (isTypingTarget(event.target) || store.getState().editingTextId) {
        return;
      }
      const elements = selectedElements();
      if (elements.length === 0 || !event.clipboardData) {
        return;
      }
      event.clipboardData.setData("text/plain", serializeElements(elements));
      event.preventDefault();
      if (event.type === "cut") {
        const ids = elements
          .filter((element) => !element.locked)
          .map((element) => element.id);
        store.getState().change((doc) => removeElements(doc, ids));
      }
    };

    const handlePaste = (event: ClipboardEvent) => {
      if (isTypingTarget(event.target) || store.getState().editingTextId) {
        return;
      }
      const data = event.clipboardData;
      const elements = parseClipboardElements(
        data?.getData("text/plain") ?? ""
      );
      if (elements) {
        event.preventDefault();
        const pasted = preparePastedElements(elements);
        const state = store.getState();
        state.change((doc) => appendElements(doc, pasted));
        state.select(pasted.map((element) => element.id));
        return;
      }

      const files = [...(data?.files ?? [])].filter((file) =>
        file.type.startsWith("image/")
      );
      if (files.length > 0) {
        event.preventDefault();
        upload(files).catch(() => null);
      }
    };

    window.addEventListener("copy", handleCopy);
    window.addEventListener("cut", handleCopy);
    window.addEventListener("paste", handlePaste);
    return () => {
      window.removeEventListener("copy", handleCopy);
      window.removeEventListener("cut", handleCopy);
      window.removeEventListener("paste", handlePaste);
    };
  }, [store, upload]);
};
