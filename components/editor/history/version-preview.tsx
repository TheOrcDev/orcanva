"use client";

import {
  RiArrowGoBackLine,
  RiArrowLeftLine,
  RiHistoryLine,
} from "@remixicon/react";
import { useCallback, useEffect, useState } from "react";

import { createStaticStore } from "@/components/editor/canvas/static-page";
import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { PreviewStage } from "@/components/editor/history/preview-stage";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { isInsidePopup } from "@/hooks/use-editor-shortcuts";
import { useRestoreVersion } from "@/hooks/use-restore-version";
import type { EditorStoreApi } from "@/lib/editor/store";
import { fetchVersion, uploadVersionThumbnail } from "@/lib/versions/api";
import { versionDocument } from "@/lib/versions/content";
import type { VersionDocument } from "@/lib/versions/content";
import {
  formatVersionTime,
  versionByline,
  versionTitle,
} from "@/lib/versions/labels";
import type { VersionSummary } from "@/lib/versions/schema";

type Loaded =
  | { status: "loading" }
  | { status: "error"; message: string }
  | {
      status: "ready";
      version: VersionSummary;
      built: VersionDocument;
      preview: EditorStoreApi;
      loadedAt: Date;
    };

// Loads a version and gets it ready to draw: its images join the editor's
// (so the export preloader knows them too), and the preview gets a store of
// its own seeded with all of them
const loadVersion = async (
  store: EditorStoreApi,
  versionId: string
): Promise<Loaded> => {
  const { designId } = store.getState();
  const data = await fetchVersion(designId, versionId);
  let built: VersionDocument;
  try {
    built = versionDocument(data.content);
  } catch {
    return {
      message:
        "This version was saved by a newer Orcanva. Reload the page to see it.",
      status: "error",
    };
  }
  store.getState().addAssets(data.assets);
  const { assets } = store.getState();
  const known = new Set(assets.map((asset) => asset.id));
  return {
    built,
    loadedAt: new Date(),
    preview: createStaticStore({
      assets,
      designId,
      document: built.document,
      missingAssetIds: data.content.assetIds.filter((id) => !known.has(id)),
      positions: built.positions,
    }),
    status: "ready",
    version: data.version,
  };
};

const PreviewHeader = ({
  loaded,
  onBack,
  onRestore,
  restoring,
}: {
  loaded: Loaded;
  onBack: () => void;
  onRestore: () => void;
  restoring: boolean;
}) => {
  const store = useEditorStoreApi();
  // A tab too old to write can't restore either
  const outdated = useEditor((state) => state.outdated);

  return (
    <header className="bg-background flex min-h-14 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b px-3 py-2">
      <Button variant="ghost" autoFocus onClick={onBack}>
        <RiArrowLeftLine data-icon="inline-start" />
        Back to editing
      </Button>
      <div className="flex min-w-0 flex-1 flex-col">
        {loaded.status === "ready" ? (
          <>
            <h2 className="truncate font-medium">
              {versionTitle(loaded.version)}
            </h2>
            <p className="text-muted-foreground truncate text-xs">
              {versionByline(loaded.version)} ·{" "}
              <time dateTime={loaded.version.createdAt}>
                {formatVersionTime(
                  new Date(loaded.version.createdAt),
                  loaded.loadedAt
                )}
              </time>{" "}
              · Preview, nothing here changes the design
            </p>
          </>
        ) : (
          <h2 className="font-medium">Version preview</h2>
        )}
      </div>
      <Button
        variant="outline"
        onClick={() => store.getState().setHistoryOpen(true)}
      >
        <RiHistoryLine data-icon="inline-start" />
        All versions
      </Button>
      {loaded.status === "ready" && !outdated ? (
        <Button disabled={restoring} onClick={onRestore}>
          {restoring ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <RiArrowGoBackLine data-icon="inline-start" />
          )}
          Restore this version
        </Button>
      ) : null}
    </header>
  );
};

const PreviewPanel = ({ versionId }: { versionId: string }) => {
  const store = useEditorStoreApi();
  const { restore, restoring } = useRestoreVersion();
  const [loaded, setLoaded] = useState<Loaded>({ status: "loading" });
  const close = useCallback(
    () => store.getState().previewVersion(null),
    [store]
  );

  useEffect(() => {
    let active = true;
    const load = async () => {
      let next: Loaded;
      try {
        next = await loadVersion(store, versionId);
      } catch {
        next = {
          message: "Check your connection, then open it again.",
          status: "error",
        };
      }
      if (active) {
        setLoaded(next);
      }
    };
    load().catch(() => null);
    return () => {
      active = false;
    };
  }, [store, versionId]);

  // Esc goes back to editing (the editor's own keys wait meanwhile)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isInsidePopup(event.target)) {
        event.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [close]);

  // A version without a picture gets one from the preview, unless parts of
  // it are missing from this tab's drawing
  const needsPicture =
    loaded.status === "ready" &&
    loaded.version.thumbnailUrl === null &&
    loaded.built.skipped.length === 0;
  const uploadPicture = useCallback(
    async (picture: Blob) => {
      await uploadVersionThumbnail(
        store.getState().designId,
        versionId,
        picture
      ).catch(() => null);
    },
    [store, versionId]
  );

  return (
    <section
      aria-label="Version preview"
      className="bg-background absolute inset-0 z-20 flex flex-col"
    >
      <PreviewHeader
        loaded={loaded}
        onBack={close}
        onRestore={() => restore(versionId)}
        restoring={restoring}
      />
      <div className="bg-muted/60 relative min-h-0 flex-1">
        {loaded.status === "loading" ? (
          <output className="text-muted-foreground absolute inset-0 flex items-center justify-center gap-2 text-sm">
            <Spinner />
            Loading this version…
          </output>
        ) : null}
        {loaded.status === "error" ? (
          <Empty>
            <EmptyHeader>
              <EmptyTitle>Couldn&apos;t open this version</EmptyTitle>
              <EmptyDescription>{loaded.message}</EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : null}
        {loaded.status === "ready" ? (
          <>
            <PreviewStage
              document={loaded.built.document}
              store={loaded.preview}
              onPicture={needsPicture ? uploadPicture : undefined}
            />
            {loaded.built.skipped.length > 0 ? (
              <p className="bg-background text-muted-foreground absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full px-4 py-2 text-sm shadow-md">
                Parts of this version were made with a newer Orcanva. Reload to
                see them.
              </p>
            ) : null}
          </>
        ) : null}
      </div>
    </section>
  );
};

// The version picked in the history sheet, shown read-only over the
// workspace, which keeps running (and saving others' edits) underneath
export const VersionPreview = () => {
  const versionId = useEditor((state) => state.previewVersionId);
  return versionId ? (
    <PreviewPanel key={versionId} versionId={versionId} />
  ) : null;
};
