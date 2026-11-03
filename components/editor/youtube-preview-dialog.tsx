"use client";

import { RiEyeLine } from "@remixicon/react";
import { useState } from "react";

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
import { DetailsForm } from "@/components/youtube-preview/details-form";
import { FILLERS } from "@/components/youtube-preview/fillers";
import type { FeedCard } from "@/components/youtube-preview/video-card";
import { YouTubeMock } from "@/components/youtube-preview/youtube-mock";
import { useDesignPreview } from "@/hooks/use-design-preview";
import type { DesignPreview } from "@/hooks/use-design-preview";
import { DEFAULT_DETAILS } from "@/lib/youtube-preview/details";
import type { PreviewDetails } from "@/lib/youtube-preview/details";
import {
  DEFAULT_LAYOUT,
  findLayout,
  thumbnailFit,
} from "@/lib/youtube-preview/layout";

// What the person's own video says under its thumbnail
const OWN_VIEWS = "12K views";
const OWN_AGE = "2 hours ago";
const FALLBACK_CHANNEL = "Your channel";

const currentCard = (
  preview: DesignPreview,
  details: PreviewDetails,
  title: string,
  channel: string,
  avatar: string | null
): FeedCard => ({
  age: OWN_AGE,
  alt: "Your design",
  avatar,
  channel,
  cover: thumbnailFit(preview.size).exact,
  duration: details.duration,
  id: "current",
  image: preview.url,
  title,
  views: OWN_VIEWS,
});

// The design in mock video feeds, at the size viewers see it, with the
// title, channel and length it'll go out with. Modal: the design can't be
// edited while it's open, but collaborators' edits still show.
export const YouTubePreviewDialog = () => {
  const store = useEditorStoreApi();
  const name = useEditor((state) => state.name);
  const viewer = useEditor((state) => state.viewer);
  const [open, setOpen] = useState(false);
  const preview = useDesignPreview(open);
  const [details, setDetails] = useState(DEFAULT_DETAILS);
  // Empty until typed: the design's name stands in
  const [title, setTitle] = useState("");

  const channelPlaceholder = viewer?.name ?? FALLBACK_CHANNEL;
  const channel = details.channel.trim() || channelPlaceholder;
  const avatar = details.avatar ?? viewer?.image ?? null;
  const layout = findLayout(DEFAULT_LAYOUT);
  const current = preview
    ? currentCard(preview, details, title.trim() || name, channel, avatar)
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
          <div className="w-full shrink-0 md:w-64">
            <DetailsForm
              details={details}
              onDetailsChange={setDetails}
              title={title}
              onTitleChange={setTitle}
              titlePlaceholder={name}
              channelPlaceholder={channelPlaceholder}
            />
          </div>
          <div className="min-w-0 flex-1">
            {current ? (
              <YouTubeMock
                feed={[current, ...FILLERS].slice(0, layout.slots)}
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
