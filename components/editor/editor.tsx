"use client";

import { useCallback, useState } from "react";

import { PageNodeProvider } from "@/components/editor/canvas-context";
import { WorkspaceStage } from "@/components/editor/canvas/workspace-stage";
import { EditorSidebar } from "@/components/editor/editor-sidebar";
import { EditorStoreProvider } from "@/components/editor/editor-store-context";
import { ExportPopover } from "@/components/editor/export-popover";
import { PropertiesPanel } from "@/components/editor/panels/properties-panel";
import { EditorToolbar } from "@/components/editor/toolbar";
import { useAssetUrlSync } from "@/hooks/use-asset-url-sync";
import { useAutosave } from "@/hooks/use-autosave";
import { useClipboard } from "@/hooks/use-clipboard";
import { useEditorShortcuts } from "@/hooks/use-editor-shortcuts";
import { useFileDrop } from "@/hooks/use-file-drop";
import { useThumbnail } from "@/hooks/use-thumbnail";
import { createEditorStore } from "@/lib/editor/store";
import type { EditorInit } from "@/lib/editor/store";

const EditorShell = ({ hasThumbnail }: { hasThumbnail: boolean }) => {
  const flushSave = useAutosave();
  const flushThumbnail = useThumbnail(hasThumbnail);
  useEditorShortcuts();
  useClipboard();
  useFileDrop();
  useAssetUrlSync();

  const flush = useCallback(async () => {
    await Promise.all([flushSave(), flushThumbnail()]);
  }, [flushSave, flushThumbnail]);

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <EditorToolbar flush={flush} actions={<ExportPopover />} />
      <div className="flex min-h-0 flex-1">
        <EditorSidebar />
        <WorkspaceStage />
        <PropertiesPanel />
      </div>
    </div>
  );
};

// One store per mounted editor so undo history never leaks between designs
export const Editor = ({ init }: { init: EditorInit }) => {
  // Created once and never replaced, so there is no setter to destructure
  // oxlint-disable-next-line react/hook-use-state
  const [store] = useState(() => createEditorStore(init));

  return (
    <EditorStoreProvider store={store}>
      <PageNodeProvider>
        <EditorShell hasThumbnail={init.hasThumbnail} />
      </PageNodeProvider>
    </EditorStoreProvider>
  );
};
