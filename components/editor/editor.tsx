"use client";

import { useState } from "react";

import { PageNodeProvider } from "@/components/editor/canvas-context";
import { WorkspaceStage } from "@/components/editor/canvas/workspace-stage";
import { EditorSidebar } from "@/components/editor/editor-sidebar";
import { EditorStoreProvider } from "@/components/editor/editor-store-context";
import { PropertiesPanel } from "@/components/editor/panels/properties-panel";
import { EditorToolbar } from "@/components/editor/toolbar";
import { useAutosave } from "@/hooks/use-autosave";
import { useEditorShortcuts } from "@/hooks/use-editor-shortcuts";
import { createEditorStore } from "@/lib/editor/store";
import type { EditorInit } from "@/lib/editor/store";

const EditorShell = () => {
  const flush = useAutosave();
  useEditorShortcuts();

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      <EditorToolbar flush={flush} />
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
        <EditorShell />
      </PageNodeProvider>
    </EditorStoreProvider>
  );
};
