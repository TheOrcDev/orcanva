"use client";

import {
  RiArrowGoBackLine,
  RiArrowGoForwardLine,
  RiArrowLeftLine,
  RiZoomInLine,
  RiZoomOutLine,
} from "@remixicon/react";
import type { RemixiconComponentType } from "@remixicon/react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import type { ReactNode } from "react";

import { DesignNameInput } from "@/components/editor/design-name-input";
import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { SaveStatus } from "@/components/editor/save-status";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { canRedo, canUndo } from "@/lib/editor/history";

const ZOOM_STEP = 1.25;
const ZOOM_PRESETS = [0.25, 0.5, 1, 2];

const ToolbarButton = ({
  label,
  icon: Icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: RemixiconComponentType;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <Tooltip>
    <TooltipTrigger
      render={
        <Button
          variant="ghost"
          size="icon"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
        />
      }
    >
      <Icon />
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);

const ZoomControls = () => {
  const store = useEditorStoreApi();
  const zoom = useEditor((state) => state.zoom);
  const { setZoom, zoomToFit } = store.getState();

  return (
    <div className="flex items-center">
      <ToolbarButton
        label="Zoom out (⌘−)"
        icon={RiZoomOutLine}
        onClick={() => setZoom(store.getState().zoom / ZOOM_STEP)}
      />
      <DropdownMenu>
        <DropdownMenuTrigger
          render={<Button variant="ghost" size="sm" className="w-16" />}
        >
          <span className="tabular-nums">{Math.round(zoom * 100)}%</span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="center">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={zoomToFit}>
              Fit to screen
              <DropdownMenuShortcut>⌘0</DropdownMenuShortcut>
            </DropdownMenuItem>
            {ZOOM_PRESETS.map((preset) => (
              <DropdownMenuItem key={preset} onClick={() => setZoom(preset)}>
                {preset * 100}%
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <ToolbarButton
        label="Zoom in (⌘+)"
        icon={RiZoomInLine}
        onClick={() => setZoom(store.getState().zoom * ZOOM_STEP)}
      />
    </div>
  );
};

export const EditorToolbar = ({
  flush,
  actions,
}: {
  flush: () => Promise<void>;
  actions?: ReactNode;
}) => {
  const router = useRouter();
  const store = useEditorStoreApi();
  const undoable = useEditor((state) => canUndo(state.history));
  const redoable = useEditor((state) => canRedo(state.history));
  const [isLeaving, startLeaving] = useTransition();

  const leave = () => {
    startLeaving(async () => {
      await flush();
      router.push("/");
    });
  };

  return (
    <header className="bg-background flex h-14 shrink-0 items-center gap-2 border-b px-3">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label="Back to designs"
              disabled={isLeaving}
              onClick={leave}
            />
          }
        >
          {isLeaving ? <Spinner /> : <RiArrowLeftLine />}
        </TooltipTrigger>
        <TooltipContent>Back to designs</TooltipContent>
      </Tooltip>
      <DesignNameInput />
      <Separator orientation="vertical" className="mx-1 h-6" />
      <ToolbarButton
        label="Undo (⌘Z)"
        icon={RiArrowGoBackLine}
        disabled={!undoable}
        onClick={() => store.getState().undo()}
      />
      <ToolbarButton
        label="Redo (⇧⌘Z)"
        icon={RiArrowGoForwardLine}
        disabled={!redoable}
        onClick={() => store.getState().redo()}
      />
      <div className="flex-1" />
      <SaveStatus onRetry={flush} />
      <ZoomControls />
      {actions}
    </header>
  );
};
