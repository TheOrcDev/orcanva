"use client";

import { RiCheckLine, RiCloseLine, RiCropLine } from "@remixicon/react";

import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Rect } from "@/lib/document/geometry";
import { PAGE_CROP_RATIOS, fullPage, wholeBox } from "@/lib/editor/page-crop";
import { selectDocument } from "@/lib/editor/store";
import { formatSize } from "@/lib/format";

// Floats over the canvas while the page is cropped
export const PageCropToolbar = ({ box }: { box: Rect }) => {
  const store = useEditorStoreApi();
  const width = useEditor((state) => selectDocument(state).width);
  const height = useEditor((state) => selectDocument(state).height);
  const ratio = useEditor((state) => state.pageCropRatio);
  // The size the page will be
  const kept = wholeBox(box, { height, width });

  const pickRatio = (value: unknown) => {
    const picked = PAGE_CROP_RATIOS.find((item) => item.value === value);
    if (picked) {
      store.getState().setPageCropRatio(picked.value);
    }
  };

  // Back to the whole page, free to take any shape
  const reset = () => {
    const state = store.getState();
    state.setPageCropRatio("free");
    state.setPageCrop(fullPage({ height, width }));
  };

  return (
    <div
      role="toolbar"
      aria-label="Crop page"
      className="bg-background absolute top-3 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3 rounded-full border px-3 py-1.5 shadow-md"
    >
      <RiCropLine className="text-muted-foreground size-4" aria-hidden />
      <output
        aria-label="New page size"
        className="text-sm whitespace-nowrap tabular-nums"
      >
        {formatSize(kept.width, kept.height)} px
      </output>
      <Select items={PAGE_CROP_RATIOS} value={ratio} onValueChange={pickRatio}>
        <SelectTrigger size="sm" aria-label="Shape">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {PAGE_CROP_RATIOS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
      <Button variant="ghost" size="sm" onClick={reset}>
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
