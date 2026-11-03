import lookBone from "@/components/landing/assets/bento/look-bone.webp";
import lookEmber from "@/components/landing/assets/bento/look-ember.webp";
import lookMist from "@/components/landing/assets/bento/look-mist.webp";
import lookSwamp from "@/components/landing/assets/bento/look-swamp.webp";
import orcPainter from "@/components/landing/assets/bento/orc-painter.webp";
import thumbnailHacks from "@/components/landing/assets/bento/thumbnail-hacks.webp";
import thumbnailLake from "@/components/landing/assets/bento/thumbnail-lake.webp";
import thumbnailSunset from "@/components/landing/assets/bento/thumbnail-sunset.webp";
import type { FeedCard } from "@/components/youtube-preview/video-card";

// The made-up videos around the one being previewed: thumbnails made in
// Orcanva for the landing page, with the filter looks as channel avatars
export const FILLERS: readonly FeedCard[] = [
  {
    age: "3 days ago",
    alt: "",
    avatar: lookSwamp,
    channel: "Swamp Studio",
    cover: true,
    description:
      "Five tricks for brushes, palettes and paper that changed how I paint.",
    duration: "14:07",
    id: "filler-hacks",
    image: thumbnailHacks,
    title: "Orc art hacks nobody tells you about",
    views: "1.2M views",
  },
  {
    age: "1 week ago",
    alt: "",
    avatar: lookEmber,
    channel: "Ember Arts",
    cover: true,
    description:
      "Warm skies, soft clouds and a glowing sun, one layer at a time.",
    duration: "10:21",
    id: "filler-sunset",
    image: thumbnailSunset,
    title: "Paint a sunset in 10 minutes, even if you've never painted",
    views: "482K views",
  },
  {
    age: "2 weeks ago",
    alt: "",
    avatar: lookMist,
    channel: "Mist and Brush",
    cover: true,
    description:
      "Too much water, muddy greens and a crooked shore. Here is how I fixed them.",
    duration: "8:45",
    id: "filler-lake",
    image: thumbnailLake,
    title: "My first lake painting: what went wrong",
    views: "96K views",
  },
  {
    age: "1 month ago",
    alt: "",
    avatar: lookBone,
    channel: "Bone Easel",
    cover: true,
    description:
      "Sketching, washes, details and the final glaze, all in one sitting.",
    duration: "1:02:18",
    id: "filler-painter",
    image: orcPainter,
    title: "A whole day painting by the lake, start to finish",
    views: "2.4M views",
  },
];
