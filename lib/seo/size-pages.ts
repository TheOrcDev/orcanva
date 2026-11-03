import { SIZE_PRESETS } from "@/lib/document/presets";
import type { PresetId, SizePreset } from "@/lib/document/presets";
import { MAX_CANVAS_SIZE } from "@/lib/document/schema";
import type { FaqEntry } from "@/lib/seo/structured-data";

// One landing page per kind of image people search a maker for, each built
// on the editor's own size presets, so the sizes they quote stay true
export interface SizePage {
  // The page's address under /
  slug: string;
  // The canvases it makes, the main one first
  presets: readonly PresetId[];
  // Short label: breadcrumbs and links from other pages
  name: string;
  // <title>, before " · Orcanva"
  title: string;
  description: string;
  heading: string;
  lead: string;
  // The main button, which opens a new design at the first preset
  cta: string;
  share: { subtitle: string; title: string };
  // Templates the page shows, 3 to 6, made for its sizes
  templates: readonly string[];
  tips: readonly { body: string; title: string }[];
  faq: readonly FaqEntry[];
}

export const SIZE_PAGES = [
  {
    cta: "Make a thumbnail",
    description:
      "Make YouTube thumbnails free at exactly 1280×720: cut yourself out of any photo, add bold outlined text, and download a JPG or PNG ready to upload.",
    faq: [
      {
        answer:
          "1280×720 pixels, a 16:9 ratio, which is what YouTube recommends (at least 640 pixels wide). Orcanva's YouTube thumbnail canvas is exactly that size.",
        question: "What size is a YouTube thumbnail?",
      },
      {
        answer:
          "JPG keeps the file small for uploading; PNG keeps text and edges perfectly crisp. Both come out at exactly 1280×720.",
        question: "Should I download a JPG or a PNG?",
      },
      {
        answer:
          "Yes. The Story size, 1080×1920, is the same 9:16 frame as Shorts, Reels and TikTok.",
        question: "Can I make vertical covers for Shorts too?",
      },
    ],
    heading: "Free YouTube thumbnail maker",
    lead: "Thumbnails at exactly 1280×720, the size YouTube recommends. Cut yourself out of any photo, add big outlined text in a font that pops, and download a file that's ready to upload.",
    name: "YouTube thumbnail maker",
    presets: ["youtube-thumbnail"],
    share: {
      subtitle: "Exactly 1280×720. Cutouts, bold text, ready to upload.",
      title: "Free YouTube thumbnail maker.",
    },
    slug: "youtube-thumbnail-maker",
    templates: [
      "shocked-reaction",
      "paint-with-me",
      "how-to-tutorial",
      "top-ten-list",
      "gaming-highlight",
      "lake-travel-vlog",
    ],
    tips: [
      {
        body: "Three or four words, big enough to read on a phone. An outline or drop shadow keeps them legible over any photo.",
        title: "Keep the text short",
      },
      {
        body: "Remove the background from a photo of yourself in one click and put your reaction right beside the title.",
        title: "Show a face",
      },
      {
        body: "Press Preview to see it at the size people scroll past it, beside other videos and on a phone, then download.",
        title: "Check it small",
      },
    ],
    title: "Free YouTube thumbnail maker, 1280×720",
  },
  {
    cta: "Make a square post",
    description:
      "Design Instagram posts free at 1080×1080 or 1080×1350: photos with filters, cutouts, text and shapes, downloaded at the exact size.",
    faq: [
      {
        answer:
          "1080×1080 pixels for a square post, and 1080×1350 for a portrait (4:5) one. Both are presets in Orcanva.",
        question: "What size is an Instagram post?",
      },
      {
        answer:
          "Yes. A 1080×1080 square works for LinkedIn and Facebook posts as well.",
        question: "Does the same size work on other networks?",
      },
    ],
    heading: "Free Instagram post maker",
    lead: "Square posts at 1080×1080 and portrait ones at 1080×1350, which take up more of the feed. Add your photos, one-tap filters, text and shapes, and download at the exact size.",
    name: "Instagram post maker",
    presets: ["square", "portrait"],
    share: {
      subtitle: "Square and portrait, with filters and text, free.",
      title: "Free Instagram post maker.",
    },
    slug: "instagram-post-maker",
    templates: [
      "quote-card",
      "summer-sale",
      "giveaway",
      "tips-carousel-cover",
      "event-poster",
    ],
    tips: [
      {
        body: "A 4:5 portrait post fills more of a phone screen than a square one, so it holds attention longer.",
        title: "Go portrait for the feed",
      },
      {
        body: "Use the same filter and fonts from post to post, and your profile looks like one body of work.",
        title: "Keep one look",
      },
      {
        body: "Keep text away from the edges, so nothing important is lost when a preview crops the post.",
        title: "Leave room at the edges",
      },
    ],
    title: "Free Instagram post maker, square and portrait",
  },
  {
    cta: "Make a Story",
    description:
      "Make Instagram Stories free at 1080×1920, the 9:16 frame Reels, Shorts and TikTok share, with background removal, text and filters.",
    faq: [
      {
        answer:
          "1080×1920 pixels, a 9:16 ratio. Reels, YouTube Shorts and TikTok use the same frame.",
        question: "What size is an Instagram Story?",
      },
      {
        answer:
          "No. Orcanva makes still images. Add one to a video in Instagram's own editor, or post it as it is.",
        question: "Can I make video Stories?",
      },
    ],
    heading: "Free Instagram Story maker",
    lead: "Stories at 1080×1920, the same 9:16 frame as Reels, YouTube Shorts and TikTok. Cut out your subject, add text and shapes, and download a picture ready to post.",
    name: "Instagram Story maker",
    presets: ["story"],
    share: {
      subtitle: "1080×1920, for Stories, Reels, Shorts and TikTok.",
      title: "Free Instagram Story maker.",
    },
    slug: "instagram-story-maker",
    templates: ["new-video-story", "this-or-that", "ask-me-anything"],
    tips: [
      {
        body: "The app's own buttons cover the top and bottom of a Story, so keep what matters in the middle.",
        title: "Mind the top and bottom",
      },
      {
        body: "Stories go by fast: one short line of text reads better than a paragraph.",
        title: "One message per frame",
      },
      {
        body: "The same 1080×1920 picture works on Reels, Shorts and TikTok without changes.",
        title: "Post it everywhere",
      },
    ],
    title: "Free Instagram Story maker, 1080×1920",
  },
  {
    cta: "Make a banner",
    description:
      "Make a LinkedIn profile banner free at exactly 1584×396: a background, your headline and logo, downloaded at the size LinkedIn asks for.",
    faq: [
      {
        answer:
          "1584×396 pixels, a 4:1 ratio, for the background photo of a personal profile.",
        question: "What size is a LinkedIn banner?",
      },
      {
        answer:
          "PNG keeps text and logos crisp; JPG gives a smaller file for photos. Either comes out at exactly 1584×396, or twice that at 2×.",
        question: "Which format should I download?",
      },
    ],
    heading: "Free LinkedIn banner maker",
    lead: "Profile banners at exactly 1584×396, the size LinkedIn recommends. Set a photo or a gradient, add your headline and logo, and download a crisp PNG or JPG.",
    name: "LinkedIn banner maker",
    presets: ["linkedin-banner"],
    share: {
      subtitle: "Exactly 1584×396, crisp on every screen.",
      title: "Free LinkedIn banner maker.",
    },
    slug: "linkedin-banner-maker",
    templates: ["creator-banner", "landscape-banner", "hiring-banner"],
    tips: [
      {
        body: "Your profile photo covers the lower left of the banner, so keep text and logos to the right.",
        title: "Leave the left side quiet",
      },
      {
        body: "One clear line about your work says more than a slogan.",
        title: "Say what you do",
      },
      {
        body: "A 2× download (3168×792) stays sharp on high-resolution screens.",
        title: "Download at 2×",
      },
    ],
    title: "Free LinkedIn banner maker, 1584×396",
  },
  {
    cta: "Make a link preview",
    description:
      "Design Open Graph images free at 1200×630, the link preview size for X, LinkedIn, Facebook, Slack and Discord, and download a PNG or JPG.",
    faq: [
      {
        answer:
          "1200×630 pixels, about 1.9:1. X, LinkedIn, Facebook, Slack and Discord all show link previews in that shape.",
        question: "What size should an og:image be?",
      },
      {
        answer:
          'Put the file on your site and point a meta tag at it, like <meta property="og:image" content="https://example.com/preview.png">. Frameworks like Next.js can add the tag for you.',
        question: "How do I add it to my site?",
      },
    ],
    heading: "Free Open Graph image maker",
    lead: "Link previews at 1200×630, the size X, LinkedIn, Facebook, Slack and Discord show when someone shares your page. Make one for every page you ship.",
    name: "Open Graph image maker",
    presets: ["open-graph"],
    share: {
      subtitle: "Link previews at 1200×630, for every page you ship.",
      title: "Free Open Graph image maker.",
    },
    slug: "og-image-generator",
    templates: ["blog-post", "product-page", "webinar"],
    tips: [
      {
        body: "Previews show small in a feed, so one large headline beats detail.",
        title: "Big title, little else",
      },
      {
        body: "Keep one layout for every page and change only the title, so your links are recognisable at a glance.",
        title: "One layout, many pages",
      },
      {
        body: "Download a PNG or JPG: every platform reads them.",
        title: "Pick a safe format",
      },
    ],
    title: "Free Open Graph image maker, 1200×630",
  },
  {
    cta: "Make a post image",
    description:
      "Make images for X (Twitter) posts free at 1600×900, the 16:9 size the timeline shows in full, with text, cutouts and filters.",
    faq: [
      {
        answer:
          "1600×900 pixels, 16:9, which the timeline shows in full. Orcanva's X post canvas is exactly that size.",
        question: "What size is an image for an X post?",
      },
      {
        answer:
          "Yes. A 16:9 image also suits LinkedIn posts, blog headers and slides.",
        question: "Can I use it elsewhere?",
      },
    ],
    heading: "Free X post image maker",
    lead: "Images for X posts at 1600×900, the 16:9 frame the timeline shows without cropping. Add a photo, a headline and your handle, and download it ready to post.",
    name: "X post image maker",
    presets: ["x-post"],
    share: {
      subtitle: "1600×900, shown in full in the timeline.",
      title: "Free X post image maker.",
    },
    slug: "x-post-maker",
    templates: ["product-launch", "big-number-stat", "thread-cover"],
    tips: [
      {
        body: "People scroll fast: a few large words over a strong photo stop them better than a busy layout.",
        title: "Make it readable at a glance",
      },
      {
        body: "Put your handle in a corner, so a reposted screenshot still leads back to you.",
        title: "Sign it",
      },
      {
        body: "Strong contrast between text and background reads in light and dark mode alike.",
        title: "Use high contrast",
      },
    ],
    title: "Free X (Twitter) post image maker, 1600×900",
  },
] as const satisfies readonly SizePage[];

export const sizePagePath = (page: SizePage): string => `/${page.slug}`;

export const findSizePage = (slug: string): SizePage | undefined =>
  SIZE_PAGES.find((page) => page.slug === slug);

export const presetsOf = (page: SizePage): SizePreset[] =>
  page.presets.flatMap((id) =>
    SIZE_PRESETS.filter((preset) => preset.id === id)
  );

// The page that makes a preset's size, if it has one
export const sizePageFor = (presetId: string): SizePage | undefined =>
  SIZE_PAGES.find((page) => page.presets.some((id) => id === presetId));

// Answers every size page shares, after its own
export const SHARED_FAQ: readonly FaqEntry[] = [
  {
    answer:
      "Yes, every feature, with no watermark. You sign up with Google or email to keep your designs.",
    question: "Is it free?",
  },
  {
    answer: `Yes. Resize the canvas to another preset or any custom size from the editor, up to ${MAX_CANVAS_SIZE} pixels a side.`,
    question: "Can I change the size later?",
  },
];
