"use client";

import { useLayoutEffect, useRef, useState } from "react";

import {
  DesktopTopBar,
  MobileBottomBar,
  MobileTopBar,
  TopicChips,
} from "@/components/youtube-preview/mock-chrome";
import type { MockViewer } from "@/components/youtube-preview/mock-chrome";
import { MockSurface } from "@/components/youtube-preview/mock-surface";
import { VideoCard } from "@/components/youtube-preview/video-card";
import type { FeedCard } from "@/components/youtube-preview/video-card";
import type { PreviewTheme } from "@/lib/youtube-preview/details";
import { findLayout, fitScale } from "@/lib/youtube-preview/layout";
import type { LayoutId } from "@/lib/youtube-preview/layout";

const HOME_TOPICS = [
  "All",
  "Painting",
  "Watercolor",
  "Tutorials",
  "Art supplies",
  "Recently uploaded",
];
const SEARCH_TOPICS = ["All", "Videos", "Unwatched", "Recently uploaded"];
const UP_NEXT_TOPICS = ["All", "Related", "Recently uploaded", "Watched"];
const MOBILE_TOPICS = ["All", "Painting", "Watercolor", "Tutorials"];

interface FeedProps {
  feed: readonly FeedCard[];
  // The thumbnail's width on screen, for picking image files
  sizes: string;
  viewer: MockViewer;
}

const HomeFeed = ({ feed, sizes, viewer }: FeedProps) => (
  <>
    <DesktopTopBar viewer={viewer} />
    <TopicChips topics={HOME_TOPICS} />
    <div className="grid grid-cols-2 gap-x-4 gap-y-10 px-6 pt-4 pb-10">
      {feed.map((card) => (
        <VideoCard key={card.id} card={card} sizes={sizes} variant="grid" />
      ))}
    </div>
  </>
);

const SearchFeed = ({ feed, sizes, viewer }: FeedProps) => (
  <>
    <DesktopTopBar viewer={viewer} />
    <TopicChips topics={SEARCH_TOPICS} />
    <div className="flex flex-col gap-4 px-6 pt-2 pb-8">
      {feed.map((card) => (
        <VideoCard key={card.id} card={card} sizes={sizes} variant="search" />
      ))}
    </div>
  </>
);

// Only the column beside the player: the player itself is the video
const UpNextFeed = ({ feed, sizes }: FeedProps) => (
  <div className="px-6 pt-2 pb-6">
    <TopicChips topics={UP_NEXT_TOPICS} className="px-0" />
    <div className="flex flex-col gap-2">
      {feed.map((card) => (
        <VideoCard key={card.id} card={card} sizes={sizes} variant="compact" />
      ))}
    </div>
  </div>
);

const MobileFeed = ({ feed, sizes, viewer }: FeedProps) => (
  <>
    <MobileTopBar viewer={viewer} />
    <TopicChips topics={MOBILE_TOPICS} className="h-12 gap-2 px-3" />
    <div className="flex flex-col">
      {feed.map((card) => (
        <VideoCard key={card.id} card={card} sizes={sizes} variant="mobile" />
      ))}
    </div>
    <MobileBottomBar />
  </>
);

const FEEDS = {
  home: HomeFeed,
  mobile: MobileFeed,
  search: SearchFeed,
  "up-next": UpNextFeed,
} as const;

// The width the mock has to fit in, measured before the first paint so a
// mock that's too wide never flashes at full size
const useAvailableWidth = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }
    setWidth(element.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
};

// A video site's page drawn in plain DOM, with the design among the other
// videos at the size people see it, shrunk only when there isn't room.
// Shared by the editor's Preview and the free preview page. It's a picture
// to look at, so screen readers get the caption instead.
export const YouTubeMock = ({
  feed,
  layout,
  letterboxed,
  theme,
  viewer,
}: {
  feed: readonly FeedCard[];
  layout: LayoutId;
  // The previewed picture isn't 16:9, so it shows between black bars
  letterboxed: boolean;
  theme: PreviewTheme;
  viewer: MockViewer;
}) => {
  const { frameWidth, id, label, thumbnailWidth } = findLayout(layout);
  const { ref, width } = useAvailableWidth();
  const scale = fitScale(frameWidth, width);
  const Feed = FEEDS[id];

  return (
    <figure className="flex min-w-0 flex-col gap-3">
      <div ref={ref} className="flex w-full justify-center">
        <div className="[zoom:var(--yt-scale)]" style={{ "--yt-scale": scale }}>
          <MockSurface
            theme={theme}
            frameWidth={frameWidth}
            thumbnailWidth={thumbnailWidth}
            className="ring-foreground/10 w-(--yt-frame) overflow-hidden rounded-2xl shadow-sm ring-1"
          >
            <div aria-hidden>
              <Feed feed={feed} sizes={`${thumbnailWidth}px`} viewer={viewer} />
            </div>
          </MockSurface>
        </div>
      </div>
      <figcaption className="text-muted-foreground flex flex-col gap-1 text-xs">
        <span className="sr-only">
          Your thumbnail in a mock {label} page, in the {theme} look.
        </span>
        {scale < 1 ? (
          <span>
            Shown at {Math.round(scale * 100)}% to fit. Widen the window to see
            it at its real size.
          </span>
        ) : null}
        {letterboxed ? (
          <span>
            Your picture isn&apos;t 16:9, so it shows between black bars.
          </span>
        ) : null}
        <span>Mock layout. Not affiliated with YouTube.</span>
      </figcaption>
    </figure>
  );
};
