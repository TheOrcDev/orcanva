"use client";

// The binding's build has no "use client" directive: import it only from
// client modules like this one
import { RealtimeProvider, useLiveQuery } from "@neon/realtime-react";
import { createRealtimeClient } from "@neon/realtime/client";
import type { SealedLiveQuery } from "@neon/realtime/client";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import type { AwaitSync } from "@/lib/collab/outbox";
import type { LiveStatus } from "@/lib/editor/store";
import type {
  LiveConfig,
  LiveElementRow,
  LivePageRow,
  LiveQueryName,
} from "@/lib/realtime/rows";

// How long a write may take to come back on the live query before we stop
// waiting and keep the local copy on screen
const AWAIT_SYNC_TIMEOUT_MS = 10_000;

type QueryStatus = "connecting" | "live" | "stale" | "error" | "closed";

const fetchSealed = async <Row,>(
  designId: string,
  query: LiveQueryName
): Promise<SealedLiveQuery<Row>> => {
  const response = await fetch(`/api/designs/${designId}/live`, {
    body: JSON.stringify({ query }),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
  if (!response.ok) {
    throw new Error(`Couldn't renew the live query (${response.status})`);
  }
  return response.json();
};

const combineStatus = (statuses: QueryStatus[]): LiveStatus => {
  if (statuses.includes("error")) {
    return "error";
  }
  if (statuses.includes("connecting") || statuses.includes("closed")) {
    return "connecting";
  }
  return statuses.includes("stale") ? "stale" : "live";
};

interface LiveQueriesProps {
  live: LiveConfig;
  setAwaitSync: (awaitSync: AwaitSync | null) => void;
}

// Subscribes to the design's page row and element rows and feeds every
// result into the store, where it's rebased under this window's own
// unconfirmed edits.
const LiveQueries = ({ live, setAwaitSync }: LiveQueriesProps) => {
  const store = useEditorStoreApi();
  const designId = useEditor((state) => state.designId);
  const refreshPage = useCallback(
    () => fetchSealed<LivePageRow>(designId, "page"),
    [designId]
  );
  const refreshElements = useCallback(
    () => fetchSealed<LiveElementRow>(designId, "elements"),
    [designId]
  );
  const page = useLiveQuery(live.page, { refreshQuery: refreshPage });
  const elements = useLiveQuery(live.elements, {
    refreshQuery: refreshElements,
  });
  const pageUtils = page.utils;
  const elementUtils = elements.utils;

  // Applied from the change listeners rather than after render, so the store
  // already has a write's echo when awaitTxId resolves (no flicker)
  useEffect(() => {
    const apply = (rows: readonly LivePageRow[] | undefined) => {
      const [row] = rows ?? [];
      if (row) {
        store.getState().applyLivePage(row);
      }
    };
    apply(pageUtils.getSnapshot().data);
    return pageUtils.onChange((snapshot) => apply(snapshot.data));
  }, [pageUtils, store]);

  useEffect(() => {
    const apply = (rows: readonly LiveElementRow[] | undefined) => {
      if (rows) {
        store.getState().applyLiveElements(rows);
      }
    };
    apply(elementUtils.getSnapshot().data);
    return elementUtils.onChange((snapshot) => apply(snapshot.data));
  }, [elementUtils, store]);

  const status = combineStatus([page.status, elements.status]);
  useEffect(() => {
    store.getState().setLiveStatus(status);
  }, [status, store]);

  // Only while streaming can the outbox wait for its writes to come back;
  // otherwise it keeps them as the synced state itself
  useEffect(() => {
    if (status !== "live") {
      setAwaitSync(null);
      return;
    }
    setAwaitSync(async (txid, touched) => {
      await Promise.all([
        touched.elements
          ? elementUtils.awaitTxId(txid, AWAIT_SYNC_TIMEOUT_MS)
          : null,
        touched.page ? pageUtils.awaitTxId(txid, AWAIT_SYNC_TIMEOUT_MS) : null,
      ]);
    });
    return () => setAwaitSync(null);
  }, [status, pageUtils, elementUtils, setAwaitSync]);

  return null;
};

// One Realtime client (one WebSocket) per session; a reconnect starts a new
// session with fresh sealed queries
const LiveSession = (props: LiveQueriesProps) => {
  // Created once per session and never replaced
  // oxlint-disable-next-line react/hook-use-state
  const [client] = useState(() =>
    // Connection problems show up as console warnings
    createRealtimeClient({ logLevel: "warn", url: props.live.url })
  );
  return (
    <RealtimeProvider client={client}>
      <LiveQueries {...props} />
    </RealtimeProvider>
  );
};

// The live queries recover from most drops by themselves; when they give up
// (error) or stay disconnected, start over with a fresh client and freshly
// sealed queries, which always begins from a complete, current result
const RECONNECT_DELAYS_MS = [1000, 3000, 10_000, 30_000];
const STUCK_AFTER_MS = 30_000;

export const LiveSync = ({ live, setAwaitSync }: LiveQueriesProps) => {
  const store = useEditorStoreApi();
  const designId = useEditor((state) => state.designId);
  const status = useEditor((state) => state.liveStatus);
  const [session, setSession] = useState({ attempt: 0, live });
  const failuresRef = useRef(0);

  const reconnect = useCallback(() => {
    const renew = async () => {
      const [page, elements] = await Promise.all([
        fetchSealed<LivePageRow>(designId, "page"),
        fetchSealed<LiveElementRow>(designId, "elements"),
      ]);
      setSession((current) => ({
        attempt: current.attempt + 1,
        live: { ...current.live, elements, page },
      }));
    };
    failuresRef.current += 1;
    store.getState().setLiveStatus("connecting");
    renew().catch(() => store.getState().setLiveStatus("error"));
  }, [designId, store]);

  useEffect(() => {
    store.getState().setReconnectLive(reconnect);
    return () => {
      store.getState().setReconnectLive(null);
      store.getState().setLiveStatus("off");
    };
  }, [reconnect, store]);

  // Watchdog: restart when the session errors out or never gets live
  useEffect(() => {
    if (status === "live") {
      failuresRef.current = 0;
      return;
    }
    if (status === "off") {
      return;
    }
    const backoff =
      RECONNECT_DELAYS_MS[
        Math.min(failuresRef.current, RECONNECT_DELAYS_MS.length - 1)
      ];
    const timer = setTimeout(
      reconnect,
      status === "error" ? backoff : STUCK_AFTER_MS
    );
    return () => clearTimeout(timer);
  }, [reconnect, status]);

  return (
    <LiveSession
      key={session.attempt}
      live={session.live}
      setAwaitSync={setAwaitSync}
    />
  );
};
