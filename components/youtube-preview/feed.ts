import { FILLERS } from "@/components/youtube-preview/fillers";
import type { FeedCard } from "@/components/youtube-preview/video-card";
import { arrangeFeed } from "@/lib/youtube-preview/layout";

// Mixed into the made-up videos, or alone side by side
export type Arrangement = "mixed" | "side";

// A thumbnail to show beside the design: a local file (a blob URL made in
// this tab) or one of the person's other designs (its gallery preview)
export interface CompareThumbnail {
  id: string;
  name: string;
  url: string;
  // Fills the 16:9 frame; otherwise it sits between black bars
  cover: boolean;
}

// The channel every one of the person's own videos goes out under
export interface OwnChannel {
  // A data URL picked for the preview, or the account's picture
  avatar: string | null;
  channel: string;
  duration: string;
}

const OWN_STATS = [
  { age: "2 hours ago", views: "12K views" },
  { age: "5 days ago", views: "8.1K views" },
  { age: "3 weeks ago", views: "31K views" },
  { age: "1 day ago", views: "2.2K views" },
];

const statsAt = (index: number) =>
  OWN_STATS[index % OWN_STATS.length] ?? { age: "", views: "" };

// The design (or image) being previewed
export const ownCard = (
  own: OwnChannel,
  picture: { cover: boolean; image: string; title: string }
): FeedCard => ({
  ...own,
  ...statsAt(0),
  alt: "Your thumbnail",
  cover: picture.cover,
  id: "current",
  image: picture.image,
  title: picture.title,
});

// What the mock shows: the design, its compares and, mixed, made-up videos
export const previewFeed = ({
  arrangement,
  compares,
  current,
  own,
  slots,
}: {
  arrangement: Arrangement;
  compares: readonly CompareThumbnail[];
  current: FeedCard;
  own: OwnChannel;
  slots: number;
}): FeedCard[] =>
  arrangeFeed(
    current,
    compares.map((compare, index) => ({
      ...own,
      ...statsAt(index + 1),
      alt: compare.name,
      cover: compare.cover,
      id: compare.id,
      image: compare.url,
      title: compare.name,
    })),
    arrangement === "side" ? [] : FILLERS,
    slots
  );
