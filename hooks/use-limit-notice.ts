"use client";

import { useEffect } from "react";

import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import { toast } from "@/components/ui/toast";
import { MAX_ELEMENTS, MAX_PAGES } from "@/lib/document/schema";
import type { LimitKind } from "@/lib/editor/store";

const MESSAGES: Record<LimitKind, { title: string; description: string }> = {
  elements: {
    description: `A design holds up to ${MAX_ELEMENTS} elements across its pages. Delete some to make room.`,
    title: "This design is full",
  },
  pages: {
    description: `A design holds up to ${MAX_PAGES} pages. Delete one to make room.`,
    title: "No room for another page",
  },
};

// Says why an edit was refused for one of the design's limits
export const useLimitNotice = (): void => {
  const store = useEditorStoreApi();
  useEffect(
    () =>
      store.subscribe((state, previous) => {
        const notice = state.limitNotice;
        if (notice && notice !== previous.limitNotice) {
          toast.add({ ...MESSAGES[notice.kind], type: "error" });
        }
      }),
    [store]
  );
};
