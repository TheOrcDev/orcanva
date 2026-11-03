"use client";

import { useEffect } from "react";

import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import { useUpload } from "@/hooks/use-upload";

const hasFiles = (event: DragEvent): boolean =>
  event.dataTransfer?.types.includes("Files") ?? false;

// Image files can be dropped anywhere in the editor. Drops over the canvas
// are placed at the pointer by the workspace; anywhere else lands centered
// instead of the browser navigating away to open the file.
export const useFileDrop = () => {
  const store = useEditorStoreApi();
  const upload = useUpload();

  useEffect(() => {
    // dragenter/dragleave fire for every child element crossed; counting
    // them is the reliable cross-browser way to know the drag left the page
    let depth = 0;
    const setActive = (active: boolean) =>
      store.getState().setFileDragActive(active);

    const handleDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) {
        return;
      }
      depth += 1;
      setActive(true);
    };

    const handleDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) {
        return;
      }
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "copy";
      }
    };

    const handleDragLeave = (event: DragEvent) => {
      if (!hasFiles(event)) {
        return;
      }
      depth = Math.max(0, depth - 1);
      if (depth === 0) {
        setActive(false);
      }
    };

    const handleDrop = (event: DragEvent) => {
      depth = 0;
      setActive(false);
      if (!hasFiles(event) || event.defaultPrevented) {
        return;
      }
      event.preventDefault();
      // Not onto a version preview, which can't change, nor while the magic
      // eraser is open
      if (store.getState().previewVersionId || store.getState().eraseTargetId) {
        return;
      }
      upload([...(event.dataTransfer?.files ?? [])]).catch(() => null);
    };

    const handleDragEnd = () => {
      depth = 0;
      setActive(false);
    };

    window.addEventListener("dragenter", handleDragEnter);
    window.addEventListener("dragover", handleDragOver);
    window.addEventListener("dragleave", handleDragLeave);
    window.addEventListener("drop", handleDrop);
    window.addEventListener("dragend", handleDragEnd);
    return () => {
      window.removeEventListener("dragenter", handleDragEnter);
      window.removeEventListener("dragover", handleDragOver);
      window.removeEventListener("dragleave", handleDragLeave);
      window.removeEventListener("drop", handleDrop);
      window.removeEventListener("dragend", handleDragEnd);
    };
  }, [store, upload]);
};
