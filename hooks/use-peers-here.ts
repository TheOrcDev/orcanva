"use client";

import { useMemo } from "react";

import { useEditor } from "@/components/editor/editor-store-context";
import { peersOnPage } from "@/lib/collab/presence";
import type { Peer } from "@/lib/collab/presence";

// Everyone else on the page on screen: only their cursors, selections and
// drags show here
export const usePeersHere = (): Peer[] => {
  const peers = useEditor((state) => state.peers);
  const pageId = useEditor((state) => state.activePageId);
  const firstPageId = useEditor((state) => state.pages[0]?.id ?? pageId);
  return useMemo(
    () => peersOnPage(peers, pageId, firstPageId),
    [peers, pageId, firstPageId]
  );
};
