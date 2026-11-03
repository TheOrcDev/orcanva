"use client";

import { RiEyeLine } from "@remixicon/react";
import { useState } from "react";

import { CompareDesignsPicker } from "@/components/editor/compare-designs-picker";
import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  ComparePicker,
  MAX_COMPARES,
  useCompares,
} from "@/components/youtube-preview/compare-picker";
import { DetailsForm } from "@/components/youtube-preview/details-form";
import { ownCard, previewFeed } from "@/components/youtube-preview/feed";
import type { Arrangement } from "@/components/youtube-preview/feed";
import { ViewControls } from "@/components/youtube-preview/view-controls";
import { YouTubeMock } from "@/components/youtube-preview/youtube-mock";
import { useDesignPreview } from "@/hooks/use-design-preview";
import { usePreviewDetails } from "@/hooks/use-preview-details";
import { loadTitle, saveTitle } from "@/lib/youtube-preview/details";
import {
  DEFAULT_LAYOUT,
  findLayout,
  thumbnailFit,
} from "@/lib/youtube-preview/layout";
import type { LayoutId } from "@/lib/youtube-preview/layout";

const FALLBACK_CHANNEL = "Your channel";

// The design in mock video feeds, at the size viewers see it, with the
// title, channel and length it'll go out with, and beside up to three other
// thumbnails. Modal: the design can't be edited while it's open, but
// collaborators' edits still show. The details stay in this browser, and
// the title is kept per design.
export const YouTubePreviewDialog = () => {
  const store = useEditorStoreApi();
  const designId = useEditor((state) => state.designId);
  const name = useEditor((state) => state.name);
  const viewer = useEditor((state) => state.viewer);
  const [open, setOpen] = useState(false);
  const preview = useDesignPreview(open);
  const [details, setDetails] = usePreviewDetails();
  const [layoutId, setLayoutId] = useState<LayoutId>(DEFAULT_LAYOUT);
  const [arrangement, setArrangement] = useState<Arrangement>("mixed");
  // Empty until typed: the design's name stands in
  const [title, setTitle] = useState(() => loadTitle(designId));
  const { add, addFiles, compares, remove } = useCompares();

  const channelPlaceholder = viewer?.name ?? FALLBACK_CHANNEL;
  const channel = details.channel.trim() || channelPlaceholder;
  const avatar = details.avatar ?? viewer?.image ?? null;
  const own = { avatar, channel, duration: details.duration };
  const layout = findLayout(layoutId);
  const current = preview
    ? ownCard(own, {
        cover: thumbnailFit(preview.size).exact,
        image: preview.url,
        title: title.trim() || name,
      })
    : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Ending a text edit commits it, so the preview shows the words
        if (next) {
          store.getState().setEditingText(null);
        }
        setOpen(next);
      }}
    >
      <DialogTrigger render={<Button variant="outline" />}>
        <RiEyeLine data-icon="inline-start" />
        Preview
      </DialogTrigger>
      <DialogContent className="flex max-h-[90svh] max-w-[95vw] flex-col sm:max-w-[min(1200px,95vw)]">
        <DialogHeader>
          <DialogTitle>Preview</DialogTitle>
          <DialogDescription>
            Your thumbnail at the size people see it, among other videos.
            Nothing here changes the design.
          </DialogDescription>
        </DialogHeader>
        <div className="-mx-6 flex min-h-0 flex-col gap-6 overflow-y-auto px-6 md:flex-row">
          <div className="flex w-full shrink-0 flex-col gap-7 md:w-64">
            <DetailsForm
              avatar={avatar}
              channel={channel}
              channelPlaceholder={channelPlaceholder}
              details={details}
              onDetailsChange={setDetails}
              title={title}
              onTitleChange={(next) => {
                setTitle(next);
                saveTitle(designId, next);
              }}
              titlePlaceholder={name}
            />
            <ComparePicker
              compares={compares}
              onAddFiles={addFiles}
              onRemove={remove}
            >
              <CompareDesignsPicker
                chosenIds={compares.map((compare) => compare.id)}
                full={compares.length >= MAX_COMPARES}
                onToggle={(design) => {
                  if (compares.some((compare) => compare.id === design.id)) {
                    remove(design.id);
                    return;
                  }
                  add([
                    {
                      cover: thumbnailFit(design).exact,
                      id: design.id,
                      name: design.name,
                      url: design.thumbnailUrl,
                    },
                  ]);
                }}
              />
            </ComparePicker>
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            <ViewControls
              arrangement={compares.length > 0 ? arrangement : undefined}
              onArrangementChange={setArrangement}
              layout={layout.id}
              onLayoutChange={setLayoutId}
              theme={details.theme}
              onThemeChange={(theme) => setDetails({ ...details, theme })}
            />
            {current ? (
              <YouTubeMock
                feed={previewFeed({
                  arrangement,
                  compares,
                  current,
                  own,
                  slots: layout.slots,
                })}
                layout={layout.id}
                letterboxed={!current.cover}
                theme={details.theme}
                viewer={{ avatar, channel }}
              />
            ) : (
              <div className="text-muted-foreground flex h-60 items-center justify-center gap-2 text-sm">
                <Spinner />
                Drawing your design…
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
