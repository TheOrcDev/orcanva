"use client";

import {
  RiArrowGoBackLine,
  RiArrowGoForwardLine,
  RiCheckLine,
  RiCloseLine,
  RiEraserLine,
} from "@remixicon/react";
import { useId } from "react";
import { useStore } from "zustand";

import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { MAX_BRUSH, MIN_BRUSH } from "@/lib/editor/magic-eraser";
import type { EraseMode, EraseModeState } from "@/lib/editor/magic-eraser";
import { stopIfOutdated } from "@/lib/editor/outdated";
import type { EditorStoreApi } from "@/lib/editor/store";
import { canRedo, canUndo, pendingStrokes } from "@/lib/magic-eraser/session";

// Runs Erase or Done, saying so when it fails. After a deploy the reload
// prompt says it all.
export const runEraseAction = async (
  editor: EditorStoreApi,
  action: () => Promise<void>,
  title: string
): Promise<void> => {
  try {
    await action();
  } catch (error) {
    if (!stopIfOutdated(editor, error)) {
      toast.add({
        description: error instanceof Error ? error.message : undefined,
        title,
        type: "error",
      });
    }
  }
};

export const ERASE_FAILED = "Couldn't erase that";
export const SAVE_FAILED = "Couldn't save the erased photo";

const statusText = ({
  busy,
  progress,
}: Pick<EraseModeState, "busy" | "progress">): string => {
  if (busy === "loading") {
    return "Loading the photo…";
  }
  if (busy === "saving") {
    return "Saving…";
  }
  if (busy !== "erasing") {
    return "";
  }
  // The model downloads once (about 37 MB), then the browser keeps it
  return progress?.stage === "download" && progress.percent < 100
    ? `Downloading the AI model… ${Math.floor(progress.percent)}%`
    : "Erasing…";
};

// Floats over the canvas while the magic eraser is open
export const EraseToolbar = ({ mode }: { mode: EraseMode }) => {
  const editor = useEditorStoreApi();
  const brushId = useId();
  const brush = useStore(mode, (state) => state.brush);
  const busy = useStore(mode, (state) => state.busy);
  const progress = useStore(mode, (state) => state.progress);
  const session = useStore(mode, (state) => state.session);
  const painted = pendingStrokes(session).length > 0;
  const status = statusText({ busy, progress });

  return (
    <div className="bg-background absolute top-3 left-1/2 z-10 flex w-max max-w-full -translate-x-1/2 flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-3xl border px-3 py-1.5 shadow-md">
      <RiEraserLine className="text-muted-foreground size-4" aria-hidden />
      <label htmlFor={brushId} className="text-sm">
        Brush
      </label>
      <Slider
        id={brushId}
        aria-label="Brush size"
        className="w-28"
        value={[brush]}
        min={MIN_BRUSH}
        max={MAX_BRUSH}
        onValueChange={(next) =>
          mode
            .getState()
            .setBrush(Array.isArray(next) ? (next[0] ?? brush) : next)
        }
      />
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Undo"
          disabled={busy !== null || !canUndo(session)}
          onClick={() => mode.getState().undo()}
        >
          <RiArrowGoBackLine />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Redo"
          disabled={busy !== null || !canRedo(session)}
          onClick={() => mode.getState().redo()}
        >
          <RiArrowGoForwardLine />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={busy !== null || !painted}
          onClick={() =>
            runEraseAction(editor, mode.getState().erase, ERASE_FAILED)
          }
        >
          {busy === "erasing" ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <RiEraserLine data-icon="inline-start" />
          )}
          Erase
        </Button>
      </div>
      <output className="text-muted-foreground text-xs" aria-live="polite">
        {status || (painted ? "" : "Paint over what to remove")}
      </output>
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={busy === "saving"}
          onClick={() => mode.getState().cancel()}
        >
          <RiCloseLine data-icon="inline-start" />
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={busy !== null}
          onClick={() =>
            runEraseAction(editor, mode.getState().done, SAVE_FAILED)
          }
        >
          {busy === "saving" ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <RiCheckLine data-icon="inline-start" />
          )}
          Done
        </Button>
      </div>
    </div>
  );
};
