"use client";

import { RiCheckLine, RiCloseLine, RiCropLine } from "@remixicon/react";

import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { Button } from "@/components/ui/button";
import type { Rect } from "@/lib/document/geometry";
import { fullPage, wholeBox } from "@/lib/editor/page-crop";
import { selectDocument } from "@/lib/editor/store";
import { formatSize } from "@/lib/format";

// Floats over the canvas while the page is cropped
export const PageCropToolbar = ({ box }: { box: Rect }) => {
  const store = useEditorStoreApi();
  const width = useEditor((state) => selectDocument(state).width);
  const height = useEditor((state) => selectDocument(state).height);
  // The size the page will be
  const kept = wholeBox(box, { height, width });

  return (
    <div className="bg-background absolute top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-full border px-3 py-1.5 shadow-md">
      <RiCropLine className="text-muted-foreground size-4" aria-hidden />
      <output
        aria-label="New page size"
        className="text-sm whitespace-nowrap tabular-nums"
      >
        {formatSize(kept.width, kept.height)} px
      </output>
      <Button
        variant="ghost"
        size="sm"
        onClick={() =>
          store.getState().setPageCrop(fullPage({ height, width }))
        }
      >
        Reset
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => store.getState().finishPageCrop(false)}
      >
        <RiCloseLine data-icon="inline-start" />
        Cancel
      </Button>
      <Button size="sm" onClick={() => store.getState().finishPageCrop(true)}>
        <RiCheckLine data-icon="inline-start" />
        Done
      </Button>
    </div>
  );
};
