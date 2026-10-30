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

  if (status === "off") {
    return null;
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
