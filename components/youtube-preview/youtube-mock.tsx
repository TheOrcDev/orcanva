import {
  DesktopTopBar,
  TopicChips,
} from "@/components/youtube-preview/mock-chrome";
import type { MockViewer } from "@/components/youtube-preview/mock-chrome";
import { MockSurface } from "@/components/youtube-preview/mock-surface";
import { VideoCard } from "@/components/youtube-preview/video-card";
import type { FeedCard } from "@/components/youtube-preview/video-card";
import type { PreviewTheme } from "@/lib/youtube-preview/details";
import { findLayout } from "@/lib/youtube-preview/layout";
import type { LayoutId } from "@/lib/youtube-preview/layout";

const HOME_TOPICS = [
  "All",
  "Painting",
  "Watercolor",
  "Tutorials",
  "Art supplies",
  "Recently uploaded",
];

const HomeFeed = ({
  feed,
  sizes,
  viewer,
}: {
  feed: readonly FeedCard[];
  sizes: string;
  viewer: MockViewer;
}) => (
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

// A video site's page drawn in plain DOM, with the design among the other
// videos at the size people see it. Shared by the editor's Preview and the
// free preview page. It's a picture to look at, so screen readers get the
// caption instead.
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
  const { frameWidth, label, thumbnailWidth } = findLayout(layout);
  return (
    <figure className="flex min-w-0 flex-col gap-3">
      <div className="overflow-x-auto">
        <MockSurface
          theme={theme}
          frameWidth={frameWidth}
          thumbnailWidth={thumbnailWidth}
          className="ring-foreground/10 w-(--yt-frame) shrink-0 overflow-hidden rounded-2xl shadow-sm ring-1"
        >
          <div aria-hidden>
            <HomeFeed
              feed={feed}
              sizes={`${thumbnailWidth}px`}
              viewer={viewer}
            />
          </div>
        </MockSurface>
      </div>
      <figcaption className="text-muted-foreground flex flex-col gap-1 text-xs">
        <span className="sr-only">
          Your thumbnail at real size in a mock {label} page, in the {theme}{" "}
          look.
        </span>
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
