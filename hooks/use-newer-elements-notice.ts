"use client";

import { useEffect } from "react";

import { useEditor } from "@/components/editor/editor-store-context";
import { toast } from "@/components/ui/toast";

// Says so, without getting in the way, while the design has elements this
// tab can't show (see skippedElementIds): a newer Orcanva made them since
// the tab was opened
export const useNewerElementsNotice = () => {
  const hasSkipped = useEditor((state) => state.skippedElementIds.length > 0);

  useEffect(() => {
    if (!hasSkipped) {
      return;
    }
    const id = toast.add({
      actionProps: {
        children: "Reload",
        onClick: () => window.location.reload(),
      },
      description: "Reload to see them.",
      timeout: 0,
      title: "Parts of this design were made with a newer Orcanva",
      type: "info",
    });
    return () => toast.close(id);
  }, [hasSkipped]);
};
