"use client";

import { RiEyeLine } from "@remixicon/react";
import { useId, useState } from "react";

import { CompareDesignsPicker } from "@/components/editor/compare-designs-picker";
import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { useYouTubePreview } from "@/components/editor/youtube-preview-context";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
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
import {
  DEFAULT_LAYOUT,
  findLayout,
  thumbnailFit,
} from "@/lib/youtube-preview/layout";
import type { LayoutId } from "@/lib/youtube-preview/layout";

// The two helpers that keep showing once the dialog is closed
const WhileEditingFields = () => {
  const id = useId();
  const { details, setDetails } = useYouTubePreview();

  return (
    <FieldSet className="min-w-0">
      <FieldLegend variant="label">While you edit</FieldLegend>
      <FieldGroup>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor={`${id}-corner`}>Corner preview</FieldLabel>
            <FieldDescription>
              Your thumbnail in Up next, kept live in a corner of the canvas.
            </FieldDescription>
          </FieldContent>
          <Switch
            id={`${id}-corner`}
            checked={details.corner}
            onCheckedChange={(corner) => setDetails({ ...details, corner })}
          />
        </Field>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor={`${id}-badge`}>Length badge</FieldLabel>
            <FieldDescription>
              Shows on the canvas where the badge covers your design, at its
              size in Up next, where it covers the most.
            </FieldDescription>
          </FieldContent>
          <Switch
            id={`${id}-badge`}
            checked={details.badgeGuide}
            onCheckedChange={(badgeGuide) =>
              setDetails({ ...details, badgeGuide })
            }
          />
        </Field>
      </FieldGroup>
    </FieldSet>
  );
};

// The design in mock video feeds, at the size viewers see it, with the
// title, channel and length it'll go out with, and beside up to three other
// thumbnails. Modal: the design can't be edited while it's open, but
// collaborators' edits still show. The details stay in this browser, and
// the title is kept per design.
export const YouTubePreviewDialog = () => {
  const store = useEditorStoreApi();
  const {
    channelPlaceholder,
    details,
    dialogOpen,
    own,
    preview,
    setDetails,
    setDialogOpen,
    setTitle,
    shownTitle,
    title,
  } = useYouTubePreview();
  const name = useEditor((state) => state.name);
  const [layoutId, setLayoutId] = useState<LayoutId>(DEFAULT_LAYOUT);
  const [arrangement, setArrangement] = useState<Arrangement>("mixed");
  const { add, addFiles, compares, remove } = useCompares();

  const layout = findLayout(layoutId);
  const current = preview
    ? ownCard(own, {
        cover: thumbnailFit(preview.size).exact,
        image: preview.url,
        title: shownTitle,
      })
    : null;

  return (
    <Dialog
      open={dialogOpen}
      onOpenChange={(next) => {
        // Ending a text edit commits it, so the preview shows the words
        if (next) {
          store.getState().setEditingText(null);
        }
        setDialogOpen(next);
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
              avatar={own.avatar}
              channel={own.channel}
              channelPlaceholder={channelPlaceholder}
              details={details}
              onDetailsChange={setDetails}
              title={title}
              onTitleChange={setTitle}
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
            <WhileEditingFields />
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
                viewer={own}
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
