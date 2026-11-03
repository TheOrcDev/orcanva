import Image from "next/image";
import type { StaticImageData } from "next/image";

import { DurationBadge } from "@/components/youtube-preview/duration-badge";
import { initials } from "@/lib/collab/identity";
import { cn } from "@/lib/utils";

// A blob, data or same-origin URL, or one of Orcanva's own pictures
export type PictureSource = string | StaticImageData;

// One video in a mock feed: the design being previewed, a thumbnail it's
// compared with, or a made-up video around them
export interface FeedCard {
  id: string;
  title: string;
  channel: string;
  avatar: PictureSource | null;
  image: PictureSource;
  // Fills the 16:9 frame; otherwise it sits in it between black bars
  cover: boolean;
  duration: string;
  views: string;
  age: string;
  // Says what the picture shows; empty for the made-up videos
  alt: string;
}

export type CardVariant = "grid";

const Picture = ({
  alt,
  className,
  sizes,
  source,
}: {
  alt: string;
  className: string;
  sizes: string;
  source: PictureSource;
}) =>
  typeof source === "string" ? (
    // oxlint-disable-next-line nextjs/no-img-element -- blob and data URLs
    <img src={source} alt={alt} className={className} />
  ) : (
    <Image src={source} alt={alt} sizes={sizes} className={className} />
  );

export const ChannelAvatar = ({
  avatar,
  channel,
  className,
}: {
  avatar: PictureSource | null;
  channel: string;
  className?: string;
}) => (
  <span
    className={cn(
      "relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-(--yt-avatar) font-medium text-(--yt-avatar-text)",
      className
    )}
  >
    {avatar ? (
      <Picture
        source={avatar}
        alt=""
        sizes="40px"
        className="absolute inset-0 size-full object-cover"
      />
    ) : (
      initials(channel)
    )}
  </span>
);

interface CardProps {
  card: FeedCard;
  // The thumbnail's width on screen, for picking a file size ("360px")
  sizes: string;
}

// The 16:9 frame at the layout's thumbnail width (--yt-thumb)
const Thumbnail = ({
  card,
  className,
  sizes,
}: CardProps & { className?: string }) => (
  <div
    className={cn(
      "relative aspect-video w-(--yt-thumb) shrink-0 overflow-hidden bg-(--yt-letterbox)",
      className
    )}
  >
    <Picture
      source={card.image}
      alt={card.alt}
      sizes={sizes}
      className={cn(
        "absolute inset-0 size-full",
        card.cover ? "object-cover" : "object-contain"
      )}
    />
    <DurationBadge duration={card.duration} />
  </div>
);

const GridCard = ({ card, sizes }: CardProps) => (
  <div className="flex w-(--yt-thumb) flex-col gap-3">
    <Thumbnail card={card} sizes={sizes} className="rounded-xl" />
    <div className="flex gap-3">
      <ChannelAvatar
        avatar={card.avatar}
        channel={card.channel}
        className="size-9 text-sm"
      />
      <div className="flex min-w-0 flex-col pr-6">
        <p className="line-clamp-2 text-base leading-5.5 font-medium break-words">
          {card.title}
        </p>
        <p className="mt-1 truncate text-sm leading-5 text-(--yt-muted)">
          {card.channel}
        </p>
        <p className="text-sm leading-5 text-(--yt-muted)">
          {card.views} · {card.age}
        </p>
      </div>
    </div>
  </div>
);

export const VideoCard = ({
  variant,
  ...props
}: CardProps & { variant: CardVariant }) => {
  switch (variant) {
    case "grid": {
      return <GridCard {...props} />;
    }
    default: {
      return variant satisfies never;
    }
  }
};
