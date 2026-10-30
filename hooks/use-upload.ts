"use client";

import { useCallback } from "react";

import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import { toast } from "@/components/ui/toast";
import type { Point } from "@/lib/document/geometry";
import { uploadImagesToCanvas } from "@/lib/upload/upload-images";

// Uploads images and places them on the canvas, toasting any failures
export const useUpload = () => {
  const store = useEditorStoreApi();

  return useCallback(
    async (files: readonly File[], at?: Point) => {
      const images = files.filter((file) => file.type.startsWith("image/"));
      if (images.length === 0) {
        toast.add({ title: "Only image files can be added", type: "error" });
        return;
      }
      const failures = await uploadImagesToCanvas(store, images, at);
      for (const failure of failures) {
        toast.add({
          description: failure.message,
          title: `Could not upload ${failure.file.name}`,
          type: "error",
        });
      }
    },
    [store]
  );
};
