"use client";

import { useCallback, useState } from "react";

import { AccessLostDialog } from "@/components/editor/access-lost-dialog";
import { PageNodeProvider } from "@/components/editor/canvas-context";
import { WorkspaceStage } from "@/components/editor/canvas/workspace-stage";
import { LiveSync } from "@/components/editor/collab/live-sync";
import { EditorSidebar } from "@/components/editor/editor-sidebar";
import {
  EditorStoreProvider,
  useEditor,
} from "@/components/editor/editor-store-context";
import { ExportPopover } from "@/components/editor/export-popover";
import { VersionPreview } from "@/components/editor/history/version-preview";
import { OutdatedDialog } from "@/components/editor/outdated-dialog";
import { PropertiesPanel } from "@/components/editor/panels/properties-panel";
import { EditorToolbar } from "@/components/editor/toolbar";
import { YouTubePreviewProvider } from "@/components/editor/youtube-preview-context";
import { YouTubePreviewDialog } from "@/components/editor/youtube-preview-dialog";
import { useAssetResolver } from "@/hooks/use-asset-resolver";
import { useAssetUrlSync } from "@/hooks/use-asset-url-sync";
import { useClipboard } from "@/hooks/use-clipboard";
import { useEditorShortcuts } from "@/hooks/use-editor-shortcuts";
import { useFileDrop } from "@/hooks/use-file-drop";
import { useNewerElementsNotice } from "@/hooks/use-newer-elements-notice";
import { useOutbox } from "@/hooks/use-outbox";
import { usePresence } from "@/hooks/use-presence";
import { useThumbnail } from "@/hooks/use-thumbnail";
import { createEditorStore } from "@/lib/editor/store";
import type { EditorInit } from "@/lib/editor/store";
import type { LiveConfig } from "@/lib/realtime/rows";

const EditorShell = ({
  hasThumbnail,
  live,
}: {
  hasThumbnail: boolean;
  live: LiveConfig | null;
}) => {
  const accessLost = useEditor((state) => state.accessLost);
  const outdated = useEditor((state) => state.outdated);
  const previewing = useEditor((state) => state.previewVersionId !== null);
  const { flush: flushSave, setAwaitSync } = useOutbox(live !== null);
  // Nothing to stream or show others once the design is gone for us
  const connected = live !== null && !accessLost;
  // An outdated tab still hears its last writes come back, but stops
  // showing itself to others
  usePresence(connected && !outdated);
  const flushThumbnail = useThumbnail(hasThumbnail);
  useEditorShortcuts();
  useClipboard();
  useFileDrop();
  useAssetUrlSync();
  useAssetResolver();
  useNewerElementsNotice();

  const flush = useCallback(async () => {
    await Promise.all([flushSave(), flushThumbnail()]);
  }, [flushSave, flushThumbnail]);

  return (
    <div className="flex h-svh flex-col overflow-hidden">
      {live && connected ? (
        <LiveSync live={live} setAwaitSync={setAwaitSync} />
      ) : null}
      <AccessLostDialog />
      <OutdatedDialog flush={flush} />
      <YouTubePreviewProvider>
        <EditorToolbar
          flush={flush}
          actions={
            <>
              <YouTubePreviewDialog />
              <ExportPopover />
            </>
          }
        />
        <div className="relative flex min-h-0 flex-1">
          {/* Stays mounted under a version preview, so live edits, the
              gallery preview and downloads keep working */}
          <div className="flex min-h-0 flex-1" inert={previewing}>
            <EditorSidebar />
            <WorkspaceStage />
            <PropertiesPanel />
          </div>
          <VersionPreview />
        </div>
      </YouTubePreviewProvider>
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
        <EditorShell
          hasThumbnail={init.hasThumbnail}
          live={init.live ?? null}
        />
      </PageNodeProvider>
    </EditorStoreProvider>
  );
};
