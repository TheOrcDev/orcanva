"use client";

import { RiRefreshLine } from "@remixicon/react";
import { useRef, useState } from "react";

import {
  ImageDropZone,
  useObjectUrl,
} from "@/components/landing/image-drop-zone";
import type { ImageDropZoneHandle } from "@/components/landing/image-drop-zone";
import { Button } from "@/components/ui/button";
import { DetailsForm } from "@/components/youtube-preview/details-form";
import { FILLERS } from "@/components/youtube-preview/fillers";
import type { FeedCard } from "@/components/youtube-preview/video-card";
import { ViewControls } from "@/components/youtube-preview/view-controls";
import { YouTubeMock } from "@/components/youtube-preview/youtube-mock";
import { usePreviewDetails } from "@/hooks/use-preview-details";
import type { Size } from "@/lib/document/geometry";
import { UPLOAD_MIME_TYPES } from "@/lib/storage/keys";
import {
  DEFAULT_LAYOUT,
  findLayout,
  thumbnailFit,
} from "@/lib/youtube-preview/layout";
import type { LayoutId } from "@/lib/youtube-preview/layout";

const ACCEPT = Object.keys(UPLOAD_MIME_TYPES).join(",");

const TITLE_PLACEHOLDER = "Your video title goes here";
const CHANNEL_PLACEHOLDER = "Your channel";
const OWN_VIEWS = "12K views";
const OWN_AGE = "2 hours ago";
const PHONE_QUERY = "(max-width: 639px)";

interface Thumbnail {
  // A blob URL, revoked when the next image replaces it
  url: string;
  size: Size;
}

const readSize = async (file: File): Promise<Size> => {
  const bitmap = await createImageBitmap(file);
  const size = { height: bitmap.height, width: bitmap.width };
  bitmap.close();
  return size;
};

// The preview around a chosen image: the details on one side, the mock on
// the other. It reads saved details from localStorage, so it only renders
// once someone has picked an image in the browser.
const PreviewStudio = ({
  onAnother,
  thumbnail,
}: {
  onAnother: () => void;
  thumbnail: Thumbnail;
}) => {
  const [details, setDetails] = usePreviewDetails();
  // On a phone, start with the phone's own feed
  const [layoutId, setLayoutId] = useState<LayoutId>(() =>
    window.matchMedia(PHONE_QUERY).matches ? "mobile" : DEFAULT_LAYOUT
  );
  const [title, setTitle] = useState("");

  const channel = details.channel.trim() || CHANNEL_PLACEHOLDER;
  const layout = findLayout(layoutId);
  const current: FeedCard = {
    age: OWN_AGE,
    alt: "Your thumbnail",
    avatar: details.avatar,
    channel,
    cover: thumbnailFit(thumbnail.size).exact,
    duration: details.duration,
    id: "current",
    image: thumbnail.url,
    title: title.trim() || TITLE_PLACEHOLDER,
    views: OWN_VIEWS,
  };

  return (
    <div className="flex w-full flex-col gap-6 self-start p-4 text-left sm:p-6 lg:flex-row">
      <div className="flex w-full shrink-0 flex-col gap-6 lg:w-64">
        <DetailsForm
          avatar={details.avatar}
          channel={channel}
          channelPlaceholder={CHANNEL_PLACEHOLDER}
          details={details}
          onDetailsChange={setDetails}
          title={title}
          onTitleChange={setTitle}
          titlePlaceholder={TITLE_PLACEHOLDER}
        />
        <Button variant="outline" onClick={onAnother}>
          <RiRefreshLine data-icon="inline-start" />
          Another image
        </Button>
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <ViewControls
          layout={layout.id}
          onLayoutChange={setLayoutId}
          theme={details.theme}
          onThemeChange={(theme) => setDetails({ ...details, theme })}
        />
        <YouTubeMock
          feed={[current, ...FILLERS].slice(0, layout.slots)}
          layout={layout.id}
          letterboxed={!current.cover}
          theme={details.theme}
          viewer={{ avatar: details.avatar, channel }}
        />
      </div>
    </div>
  );
};

// The editor's YouTube preview for any image: it's shown straight from this
// device, so nothing is uploaded and nobody needs an account
export const YouTubePreviewTool = () => {
  const dropZone = useRef<ImageDropZoneHandle>(null);
  const show = useObjectUrl();
  const [thumbnail, setThumbnail] = useState<Thumbnail | null>(null);
  const [error, setError] = useState<string>();

  const take = async (image: File) => {
    try {
      const size = await readSize(image);
      setThumbnail({ size, url: show(image) });
      setError(undefined);
    } catch {
      setThumbnail(null);
      setError(`${image.name} could not be read as an image`);
    }
  };

  return (
    <ImageDropZone
      ref={dropZone}
      accept={ACCEPT}
      error={error}
      formats="JPG, PNG, WebP or GIF"
      onImage={take}
      className={thumbnail ? "aspect-auto sm:aspect-auto" : undefined}
    >
      {thumbnail ? (
        <PreviewStudio
          thumbnail={thumbnail}
          onAnother={() => dropZone.current?.choose()}
        />
      ) : null}
    </ImageDropZone>
  );
};
