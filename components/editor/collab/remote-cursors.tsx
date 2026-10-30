"use client";

import { useEditor } from "@/components/editor/editor-store-context";
import { isLightColor } from "@/lib/collab/identity";
import type { Peer } from "@/lib/collab/presence";
import { cn } from "@/lib/utils";

interface ScreenPoint {
  x: number;
  y: number;
}

// Cursor updates arrive about every 100 ms; gliding over that interval hides
// the steps
const RemoteCursor = ({ peer, at }: { peer: Peer; at: ScreenPoint }) => (
  <div
    className="absolute top-0 left-0 flex translate-x-(--cursor-x) translate-y-(--cursor-y) items-start transition-transform duration-100 ease-linear"
    style={{
      "--cursor-x": `${at.x}px`,
      "--cursor-y": `${at.y}px`,
      "--peer-color": peer.color,
    }}
  >
    <svg
      aria-hidden
      className="fill-(--peer-color) stroke-white drop-shadow-sm"
      width="18"
      height="20"
      viewBox="0 0 18 20"
    >
      <path d="M1.5 1.5 16 9.6l-6.6 1.8-3.3 6.7z" strokeWidth="1.5" />
    </svg>
    <span
      className={cn(
        "mt-3.5 -ml-1 rounded-full bg-(--peer-color) px-2 py-0.5 text-xs font-medium whitespace-nowrap shadow-sm",
        isLightColor(peer.color) ? "text-black" : "text-white"
      )}
    >
      {peer.name}
    </span>
  </div>
);

// Everyone else's pointer over this window's canvas. Positions are stored in
// page coordinates, so they line up whatever each person's zoom and pan.
export const RemoteCursors = ({
  origin,
  zoom,
}: {
  origin: ScreenPoint;
  zoom: number;
}) => {
  const peers = useEditor((state) => state.peers);

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
    >
      {peers.map((peer) =>
        peer.cursor ? (
          <RemoteCursor
            key={peer.clientId}
            peer={peer}
            at={{
              x: origin.x + peer.cursor.x * zoom,
              y: origin.y + peer.cursor.y * zoom,
            }}
          />
        ) : null
      )}
    </div>
  );
};
