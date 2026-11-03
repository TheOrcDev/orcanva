"use client";

import { createContext, use, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { useEditor } from "@/components/editor/editor-store-context";
import type { OwnChannel } from "@/components/youtube-preview/feed";
import { useDesignPreview } from "@/hooks/use-design-preview";
import type { DesignPreview } from "@/hooks/use-design-preview";
import { usePreviewDetails } from "@/hooks/use-preview-details";
import { loadTitle, saveTitle } from "@/lib/youtube-preview/details";
import type { PreviewDetails } from "@/lib/youtube-preview/details";

const FALLBACK_CHANNEL = "Your channel";

interface YouTubePreviewValue {
  // The rendered design while the dialog or the corner preview shows it
  preview: DesignPreview | null;
  details: PreviewDetails;
  setDetails: (details: PreviewDetails) => void;
  // The design's video title; empty means its name
  title: string;
  setTitle: (title: string) => void;
  // The title the mock shows
  shownTitle: string;
  channelPlaceholder: string;
  own: OwnChannel;
  dialogOpen: boolean;
  setDialogOpen: (open: boolean) => void;
}

const YouTubePreviewContext = createContext<YouTubePreviewValue | null>(null);

// What the Preview dialog, the corner preview and the badge guide share: the
// details this browser keeps, and one render of the design for all of them,
// made only while one of them shows it
export const YouTubePreviewProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  const designId = useEditor((state) => state.designId);
  const name = useEditor((state) => state.name);
  const viewer = useEditor((state) => state.viewer);
  const [details, setDetails] = usePreviewDetails();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState(() => loadTitle(designId));
  const preview = useDesignPreview(dialogOpen || details.corner);

  const value = useMemo((): YouTubePreviewValue => {
    const channelPlaceholder = viewer?.name ?? FALLBACK_CHANNEL;
    return {
      channelPlaceholder,
      details,
      dialogOpen,
      own: {
        avatar: details.avatar ?? viewer?.image ?? null,
        channel: details.channel.trim() || channelPlaceholder,
        duration: details.duration,
      },
      preview,
      setDetails,
      setDialogOpen,
      setTitle: (next) => {
        setTitle(next);
        saveTitle(designId, next);
      },
      shownTitle: title.trim() || name,
      title,
    };
  }, [designId, details, dialogOpen, name, preview, setDetails, title, viewer]);

  return (
    <YouTubePreviewContext value={value}>{children}</YouTubePreviewContext>
  );
};

export const useYouTubePreview = (): YouTubePreviewValue => {
  const value = use(YouTubePreviewContext);
  if (!value) {
    throw new Error(
      "useYouTubePreview must be used inside YouTubePreviewProvider"
    );
  }
  return value;
};
