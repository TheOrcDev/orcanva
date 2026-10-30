"use client";

import { RiCheckLine, RiErrorWarningLine } from "@remixicon/react";

import { useEditor } from "@/components/editor/editor-store-context";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";

export const SaveStatus = ({ onRetry }: { onRetry: () => Promise<void> }) => {
  const status = useEditor((state) => state.saveStatus);

  if (status === "error") {
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          onRetry().catch(() =>
            toast.add({ title: "Still couldn't save", type: "error" })
          );
        }}
      >
        <RiErrorWarningLine data-icon="inline-start" />
        Not saved · Retry
      </Button>
    );
  }

  const label = {
    saved: "Saved",
    saving: "Saving…",
    unsaved: "Unsaved changes",
  }[status];

  return (
    <output
      className="text-muted-foreground flex items-center gap-1.5 px-2 text-xs"
      aria-live="polite"
    >
      {status === "saved" ? <RiCheckLine aria-hidden /> : null}
      {status === "saving" ? <Spinner /> : null}
      {label}
    </output>
  );
};
