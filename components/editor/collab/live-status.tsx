"use client";

import { RiWifiOffLine } from "@remixicon/react";

import { useEditor } from "@/components/editor/editor-store-context";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const LABELS = {
  connecting: "Connecting…",
  live: "Live",
  stale: "Reconnecting…",
} as const;

const HINTS = {
  connecting: "Connecting to live updates",
  live: "Everyone on this design sees changes as they happen",
  stale: "Live updates paused; reconnecting",
} as const;

// Whether this window is receiving everyone else's changes live
export const LiveStatus = () => {
  const status = useEditor((state) => state.liveStatus);
  const reconnect = useEditor((state) => state.reconnectLive);

  // Without Realtime settings the editor still saves, but nobody sees
  // anyone else's changes until they reload; say so instead of hiding it
  if (status === "off") {
    return (
      <Tooltip>
        <TooltipTrigger render={<span />}>
          <output className="text-muted-foreground flex items-center gap-1.5 px-2 text-xs">
            <span
              aria-hidden
              className="bg-muted-foreground/50 size-2 rounded-full"
            />
            Not live
          </output>
        </TooltipTrigger>
        <TooltipContent>
          Live collaboration is off on this server (NEON_REALTIME_URL and
          NEON_REALTIME_SECRET aren&apos;t set). Changes still save; others see
          them after a reload.
        </TooltipContent>
      </Tooltip>
    );
  }

  if (status === "error") {
    return (
      <Button
        variant="ghost"
        size="sm"
        disabled={!reconnect}
        onClick={() => reconnect?.()}
      >
        <RiWifiOffLine data-icon="inline-start" />
        Live updates stopped · Reconnect
      </Button>
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger render={<span />}>
        <output
          className="text-muted-foreground flex items-center gap-1.5 px-2 text-xs"
          aria-live="polite"
        >
          <span
            aria-hidden
            className={cn(
              "size-2 rounded-full",
              status === "live" ? "bg-success" : "bg-warning animate-pulse"
            )}
          />
          {LABELS[status]}
        </output>
      </TooltipTrigger>
      <TooltipContent>{HINTS[status]}</TooltipContent>
    </Tooltip>
  );
};
