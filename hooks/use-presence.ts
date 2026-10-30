"use client";

import { useEffect } from "react";

import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import {
  PRESENCE_HEARTBEAT_MS,
  createPresenceSender,
} from "@/lib/collab/presence";
import type { PresenceState } from "@/lib/collab/presence";

const NOT_FOUND = 404;

const presenceOf = (
  state: ReturnType<ReturnType<typeof useEditorStoreApi>["getState"]>
): PresenceState => ({
  color: state.profile.color,
  drag: state.dragPreview,
  name: state.profile.name,
  selection: state.selectedIds,
  x: state.pointer?.x ?? null,
  y: state.pointer?.y ?? null,
});

// Tells everyone else on the design where this session's pointer is, what
// it has selected and what it's dragging (only when Realtime is on, since
// nobody could see it otherwise)
export const usePresence = (enabled: boolean): void => {
  const store = useEditorStoreApi();

  useEffect(() => {
    if (!enabled) {
      return;
    }
    const { clientId, designId } = store.getState();
    const url = `/api/designs/${designId}/presence`;

    const sender = createPresenceSender({
      initial: presenceOf(store.getState()),
      send: async (presence) => {
        const response = await fetch(url, {
          body: JSON.stringify({ clientId, ...presence }),
          headers: { "Content-Type": "application/json" },
          method: "PUT",
        });
        if (response.ok) {
          const { now }: { now: number } = await response.json();
          store.getState().setServerOffset(now - Date.now());
        } else if (response.status === NOT_FOUND) {
          // Made private or deleted while we were on it
          store.getState().loseAccess();
        }
      },
    });

    const unsubscribe = store.subscribe((state, previous) => {
      const changed =
        state.pointer !== previous.pointer ||
        state.selectedIds !== previous.selectedIds ||
        state.profile !== previous.profile ||
        state.dragPreview !== previous.dragPreview;
      if (changed) {
        sender.update(presenceOf(state));
      }
    });

    // Drop people whose heartbeat stopped even when no new rows arrive
    const ticker = setInterval(() => {
      store.getState().refreshPeers();
    }, PRESENCE_HEARTBEAT_MS);

    const leave = () => {
      fetch(`${url}?clientId=${clientId}`, {
        keepalive: true,
        method: "DELETE",
      }).catch(() => null);
    };
    window.addEventListener("pagehide", leave);

    return () => {
      unsubscribe();
      sender.dispose();
      clearInterval(ticker);
      window.removeEventListener("pagehide", leave);
      leave();
    };
  }, [enabled, store]);
};
