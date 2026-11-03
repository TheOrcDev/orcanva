"use client";

import type Konva from "konva";
import { useEffect, useState } from "react";

import { StaticPageView } from "@/components/editor/canvas/static-page";
import { Spinner } from "@/components/ui/spinner";
import type { DesignDocument } from "@/lib/document/schema";
import type { EditorStoreApi } from "@/lib/editor/store";
import { prepareForRender } from "@/lib/export/prepare";
import { renderThumbnail } from "@/lib/export/render-page";
import { cn } from "@/lib/utils";

// A version drawn full-size and read-only. It stays hidden until the render
// preparers say everything on it is drawn (fonts, images and their filters,
// photo effects), so it never shows a half-loaded page. Then, for a version
// without a picture, it draws one from the same page for `onPicture`.
export const PreviewStage = ({
  document,
  store,
  onPicture,
}: {
  document: DesignDocument;
  // The preview's own store (createStaticStore), not the editor's
  store: EditorStoreApi;
  onPicture?: (picture: Blob) => Promise<void>;
}) => {
  const [node, setNode] = useState<Konva.Group | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!node) {
      return;
    }
    let active = true;
    const prepare = async () => {
      try {
        await prepareForRender(document);
      } catch {
        // Show what did load rather than nothing
      }
      if (!active) {
        return;
      }
      setReady(true);
      if (onPicture) {
        await onPicture(await renderThumbnail(node, document));
      }
    };
    prepare().catch(() => null);
    return () => {
      active = false;
    };
  }, [document, node, onPicture]);

  return (
    <div className="relative size-full">
      <StaticPageView
        className={cn(
          "size-full transition-opacity duration-150",
          ready ? "opacity-100" : "opacity-0"
        )}
        document={document}
        onPage={setNode}
        store={store}
      />
      {ready ? null : (
        <output className="text-muted-foreground absolute inset-0 flex items-center justify-center gap-2 text-sm">
          <Spinner />
          Drawing this version…
        </output>
      )}
    </div>
  );
};
