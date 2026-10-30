"use client";

import { useEffect } from "react";

import { isTypingTarget } from "@/hooks/use-editor-shortcuts";
import { useUpload } from "@/hooks/use-upload";

// ⌘V with an image on the clipboard (e.g. a screenshot) uploads and places it
export const usePasteImages = () => {
  const upload = useUpload();

  useEffect(() => {
    const handlePaste = (event: ClipboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }
      const files = [...(event.clipboardData?.files ?? [])].filter((file) =>
        file.type.startsWith("image/")
      );
      if (files.length === 0) {
        return;
      }
      event.preventDefault();
      upload(files).catch(() => null);
    };

    window.addEventListener("paste", handlePaste);
    return () => window.removeEventListener("paste", handlePaste);
  }, [upload]);
};
