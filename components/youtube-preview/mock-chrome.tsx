import {
  RiAddLine,
  RiCompass3Line,
  RiHome5Fill,
  RiMenuLine,
  RiSearchLine,
  RiStackLine,
  RiUserLine,
} from "@remixicon/react";

import { ChannelAvatar } from "@/components/youtube-preview/video-card";
import type { PictureSource } from "@/components/youtube-preview/video-card";
import { cn } from "@/lib/utils";

// Where a site's logo would sit: a plain block, so the mock never carries
// anyone's logo or wordmark
const LogoPlaceholder = ({ className }: { className?: string }) => (
  <span className={cn("block h-5 rounded-sm bg-(--yt-block)", className)} />
);

export interface MockViewer {
  avatar: PictureSource | null;
  channel: string;
}

// The bar across the top of the desktop site: menu, logo, search, account
export const DesktopTopBar = ({ viewer }: { viewer: MockViewer }) => (
  <div className="flex h-14 items-center gap-4 px-4">
    <div className="flex w-40 shrink-0 items-center gap-4">
      <span className="flex size-10 items-center justify-center">
        <RiMenuLine className="size-6" />
      </span>
      <LogoPlaceholder className="w-22" />
    </div>
    <div className="flex min-w-0 flex-1 justify-center">
      <div className="flex h-10 w-full max-w-110 items-center rounded-full border border-(--yt-border)">
        <span className="flex-1 truncate px-4 text-base text-(--yt-muted)">
          Search
        </span>
        <span className="flex h-full w-16 items-center justify-center rounded-r-full border-l border-(--yt-border) bg-(--yt-surface)">
          <RiSearchLine className="size-5" />
        </span>
      </div>
    </div>
    <div className="flex w-40 shrink-0 justify-end">
      <ChannelAvatar
        avatar={viewer.avatar}
        channel={viewer.channel}
        className="size-8 text-xs"
      />
    </div>
  </div>
);

// The top of a phone's feed: logo, search and account
export const MobileTopBar = ({ viewer }: { viewer: MockViewer }) => (
  <div className="flex h-12 items-center gap-5 px-3">
    <LogoPlaceholder className="w-20" />
    <span className="flex-1" />
    <RiSearchLine className="size-6" />
    <ChannelAvatar
      avatar={viewer.avatar}
      channel={viewer.channel}
      className="size-7 text-xs"
    />
  </div>
);

const MOBILE_TABS = [
  { icon: RiHome5Fill, id: "home" },
  { icon: RiCompass3Line, id: "explore" },
  { icon: RiAddLine, id: "create" },
  { icon: RiStackLine, id: "library" },
  { icon: RiUserLine, id: "you" },
];

// The tabs along the bottom of a phone's feed, as plain icons
export const MobileBottomBar = () => (
  <div className="flex h-12 items-center justify-around border-t border-(--yt-border)">
    {MOBILE_TABS.map(({ icon: Icon, id }) => (
      <Icon key={id} className="size-6" />
    ))}
  </div>
);

// The topics above a feed, the first one picked
export const TopicChips = ({
  className,
  topics,
}: {
  className?: string;
  topics: readonly string[];
}) => (
  <div
    className={cn(
      "flex h-14 items-center gap-3 overflow-hidden px-6",
      className
    )}
  >
    {topics.map((topic, index) => (
      <span
        key={topic}
        className={cn(
          "flex h-8 shrink-0 items-center rounded-lg px-3 text-sm font-medium",
          index === 0
            ? "bg-(--yt-active) text-(--yt-active-text)"
            : "bg-(--yt-surface)"
        )}
      >
        {topic}
      </span>
    ))}
  </div>
);
