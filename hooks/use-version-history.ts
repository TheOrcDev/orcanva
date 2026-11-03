"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { fetchVersions } from "@/lib/versions/api";
import type { VersionSummary } from "@/lib/versions/schema";

export type VersionListStatus = "loading" | "ready" | "error";

export interface VersionHistory {
  versions: VersionSummary[];
  status: VersionListStatus;
  // There are older versions to load
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => Promise<void>;
  // Loads the newest page again (after saving, restoring or deleting)
  refresh: () => Promise<void>;
  // Shows the list as loading, then loads it (after an error)
  retry: () => Promise<void>;
  // When the list was loaded, for "today" and "yesterday"
  loadedAt: Date;
}

// The design's versions, newest first, loaded each time the history sheet
// opens
export const useVersionHistory = (): VersionHistory => {
  const store = useEditorStoreApi();
  const designId = useEditor((state) => state.designId);
  const [versions, setVersions] = useState<VersionSummary[]>([]);
  const [next, setNext] = useState<string | null>(null);
  const [status, setStatus] = useState<VersionListStatus>("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadedAt, setLoadedAt] = useState(() => new Date());
  // Only the newest request's answer counts
  const requestRef = useRef(0);

  const refresh = useCallback(async () => {
    const request = requestRef.current + 1;
    requestRef.current = request;
    try {
      const page = await fetchVersions(designId);
      if (requestRef.current === request) {
        setVersions(page.versions);
        setNext(page.next);
        setLoadedAt(new Date());
        setStatus("ready");
      }
    } catch {
      if (requestRef.current === request) {
        setStatus("error");
      }
    }
  }, [designId]);

  const retry = useCallback(async () => {
    setStatus("loading");
    await refresh();
  }, [refresh]);

  const loadMore = useCallback(async () => {
    if (!next || loadingMore) {
      return;
    }
    const request = requestRef.current;
    setLoadingMore(true);
    try {
      const page = await fetchVersions(designId, next);
      if (requestRef.current === request) {
        setVersions((current) => [...current, ...page.versions]);
        setNext(page.next);
      }
    } catch {
      // The button stays, so another press tries again
    }
    setLoadingMore(false);
  }, [designId, loadingMore, next]);

  useEffect(
    () =>
      store.subscribe((state, previous) => {
        if (state.historyOpen && !previous.historyOpen) {
          refresh().catch(() => null);
        }
      }),
    [refresh, store]
  );

  return {
    hasMore: next !== null,
    loadMore,
    loadedAt,
    loadingMore,
    refresh,
    retry,
    status,
    versions,
  };
};
