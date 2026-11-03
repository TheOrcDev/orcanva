"use client";

import { useEffect, useState } from "react";

import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { toast } from "@/components/ui/toast";
import { photoAssetId } from "@/lib/editor/derived-images";
import { findElement } from "@/lib/editor/document-ops";
import { createEraseMode } from "@/lib/editor/magic-eraser";
import type { EraseMode } from "@/lib/editor/magic-eraser";
import type { EditorStoreApi } from "@/lib/editor/store";
import { selectDocument } from "@/lib/editor/store";

const couldNotOpen = (error: unknown) =>
  toast.add({
    description: error instanceof Error ? error.message : undefined,
    title: "Couldn't open the magic eraser",
    type: "error",
  });

interface OpenMode {
  id: string | null;
  mode: EraseMode | null;
}

// A session for the image the eraser is open on, or none when its photo
// isn't known here
const modeFor = (editor: EditorStoreApi, id: string | null): OpenMode => {
  if (!id) {
    return { id, mode: null };
  }
  const state = editor.getState();
  const assetId = photoAssetId(findElement(selectDocument(state), id));
  const source = state.assets.find((asset) => asset.id === assetId);
  return {
    id,
    mode: source ? createEraseMode(editor, id, source, couldNotOpen) : null,
  };
};

// The magic eraser session for the image it's open on (eraseTargetId), made
// when it opens and let go when it closes. The workspace shares it between
// the toolbar and the canvas overlay.
export const useEraseMode = (): EraseMode | null => {
  const editor = useEditorStoreApi();
  const targetId = useEditor((state) => state.eraseTargetId);
  const [open, setOpen] = useState<OpenMode>(() => modeFor(editor, targetId));

  // A new target makes a new session (derived state, not an effect)
  let current = open;
  if (open.id !== targetId) {
    current = modeFor(editor, targetId);
    setOpen(current);
  }
  const { mode } = current;

  useEffect(() => {
    if (!targetId) {
      return;
    }
    if (!mode) {
      // Nothing to erase on
      editor.getState().finishErase();
      return;
    }
    mode.getState().open();
    return () => mode.getState().dispose();
  }, [editor, mode, targetId]);

  return mode;
};
