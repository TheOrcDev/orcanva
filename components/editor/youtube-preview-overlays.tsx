"use client";

import { RiCloseLine, RiExpandDiagonalLine } from "@remixicon/react";

import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { useYouTubePreview } from "@/components/editor/youtube-preview-context";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DurationBadge } from "@/components/youtube-preview/duration-badge";
import { ownCard } from "@/components/youtube-preview/feed";
import { MockSurface } from "@/components/youtube-preview/mock-surface";
import { VideoCard } from "@/components/youtube-preview/video-card";
import type { Point } from "@/lib/document/geometry";
import { selectDocument } from "@/lib/editor/store";
import { findLayout, thumbnailFit } from "@/lib/youtube-preview/layout";

// The smallest thumbnail of all, where the badge covers the most
const UP_NEXT = findLayout("up-next");

const CornerButton = ({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof RiCloseLine;
  label: string;
  onClick: () => void;
}) => (
  <Tooltip>
    <TooltipTrigger
      render={
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={label}
          onClick={onClick}
        />
      }
    >
      <Icon />
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);

// The design as a video card at the Up next column's thumbnail size, live
// while you edit, in the bottom-left corner of the canvas, away from the
// corner the length badge covers. Stacked like a home page card, so it
// stays narrow. Turned on and off in the Preview dialog.
export const CornerPreview = () => {
  const store = useEditorStoreApi();
  const { details, own, preview, setDetails, setDialogOpen, shownTitle } =
    useYouTubePreview();

  if (!details.corner) {
    return null;
  }

  return (
    <section
      aria-label="Corner preview"
      className="bg-background ring-foreground/10 absolute bottom-4 left-4 z-10 flex flex-col gap-1 rounded-2xl p-2 shadow-lg ring-1 max-md:hidden"
    >
      <div className="flex items-center gap-1 pl-2">
        <span className="text-muted-foreground flex-1 text-xs font-medium">
          Real size, as in Up next
        </span>
        <CornerButton
          icon={RiExpandDiagonalLine}
          label="Open Preview"
          onClick={() => {
            store.getState().setEditingText(null);
            setDialogOpen(true);
          }}
        />
        <CornerButton
          icon={RiCloseLine}
          label="Hide the corner preview"
          onClick={() => setDetails({ ...details, corner: false })}
        />
      </div>
      <MockSurface
        theme={details.theme}
        thumbnailWidth={UP_NEXT.thumbnailWidth}
        className="rounded-xl p-2 pb-0"
      >
        {preview ? (
          <div aria-hidden>
            <VideoCard
              card={ownCard(own, {
                cover: thumbnailFit(preview.size).exact,
                image: preview.url,
                title: shownTitle,
              })}
              sizes={`${UP_NEXT.thumbnailWidth}px`}
              variant="grid"
            />
          </div>
        ) : (
          <div className="flex aspect-video w-(--yt-thumb) items-center justify-center">
            <Spinner />
          </div>
        )}
      </MockSurface>
    </section>
  );
};

// The length badge drawn over the canvas where it lands on the thumbnail,
// at its size on the smallest one. Designs that aren't 16:9 are framed as
// the feed frames them, so on those it can sit over a black bar, off the
// page.
export const BadgeGuide = ({
  origin,
  zoom,
}: {
  origin: Point;
  zoom: number;
}) => {
  const { details } = useYouTubePreview();
  const width = useEditor((state) => selectDocument(state).width);
  const height = useEditor((state) => selectDocument(state).height);

  if (!details.badgeGuide) {
    return null;
  }

  const fit = thumbnailFit({ height, width });
  const frameWidth = (width / fit.width) * zoom;
  const frameHeight = (height / fit.height) * zoom;

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-10 overflow-hidden"
    >
      <div
        className="absolute top-0 left-0 origin-top-left translate-x-(--guide-x) translate-y-(--guide-y) scale-(--guide-scale)"
        style={{
          "--guide-scale": frameWidth / UP_NEXT.thumbnailWidth,
          "--guide-x": `${origin.x - fit.x * frameWidth}px`,
          "--guide-y": `${origin.y - fit.y * frameHeight}px`,
        }}
      >
        <MockSurface
          theme={details.theme}
          thumbnailWidth={UP_NEXT.thumbnailWidth}
          className="relative aspect-video w-(--yt-thumb) bg-transparent"
        >
          <DurationBadge duration={details.duration} />
        </MockSurface>
      </div>
    </div>
  );
};
