import { RiArrowRightLine } from "@remixicon/react";
import type { Metadata } from "next";

import { CardList } from "@/components/landing/card-list";
import { Container } from "@/components/landing/container";
import { Faq } from "@/components/landing/faq";
import { PageIntro } from "@/components/landing/page-intro";
import { RelatedPages } from "@/components/landing/related-pages";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteNav } from "@/components/landing/site-nav";
import { YouTubePreviewTool } from "@/components/landing/youtube-preview-tool";
import { JsonLd } from "@/components/seo/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { YOUTUBE_PREVIEW_PATH, newDesignPath } from "@/lib/routes";
import { pageStructuredData } from "@/lib/seo/structured-data";
import type { FaqEntry } from "@/lib/seo/structured-data";

const DESCRIPTION =
  "See your YouTube thumbnail at real size on a mock home page, in search, beside a video and on a phone, in light and dark. Free, in your browser: nothing is uploaded.";

export const metadata: Metadata = {
  alternates: { canonical: YOUTUBE_PREVIEW_PATH },
  description: DESCRIPTION,
  title: "Free YouTube thumbnail preview, no sign-up",
};

const CHECKS = [
  {
    body: "Each layout shows thumbnails at the width they get on a laptop or a phone, so small text looks as small as it will.",
    title: "Real size",
  },
  {
    body: "The video's length sits over the bottom-right corner everywhere. Keep faces and words out from under it.",
    title: "The corner the length covers",
  },
  {
    body: "Plenty of people browse in dark mode. Check that your edges and colours still stand out on a black page.",
    title: "Light and dark",
  },
  {
    body: "The home page, search results, the Up next column beside a video, and a phone's feed, where thumbnails go edge to edge.",
    title: "Four places it shows",
  },
  {
    body: "Type the real title to see where it wraps, and whether the picture and the words tell the same story.",
    title: "Your title and channel",
  },
  {
    body: "Add up to three more thumbnails, other versions of yours or another channel's, and see which one stands out.",
    title: "Next to other thumbnails",
  },
];

const STEPS = [
  {
    body: "Choose a JPG, PNG, WebP or GIF, drop it on the box, or paste it from your clipboard.",
    title: "Add your thumbnail",
  },
  {
    body: "Type the title, your channel's name and the video's length, and pick a channel picture if you like.",
    title: "Fill in the details",
  },
  {
    body: "Switch between the home page, search, Up next and a phone, in light or dark, and fix what doesn't read.",
    title: "Look at every layout",
  },
];

const FAQ: FaqEntry[] = [
  {
    answer:
      "Yes, with no account, no limit and no watermark. It all runs in your browser.",
    question: "Is it free?",
  },
  {
    answer:
      "No. Your browser shows the image straight from your device. The title, channel and picture you type stay in this browser too.",
    question: "Is my thumbnail uploaded anywhere?",
  },
  {
    answer:
      "No. It's a mock layout that copies the sizes thumbnails are shown at, not YouTube's own design, and it isn't affiliated with YouTube. The sizes change from time to time; these were last checked in November 2026.",
    question: "Is this the real YouTube page?",
  },
  {
    answer:
      "Yes. Add up to three more images and see them mixed in with other videos or side by side. They're shown from your device too, never uploaded.",
    question: "Can I compare it with other thumbnails?",
  },
  {
    answer:
      "1280×720 pixels, a 16:9 ratio, which is what YouTube recommends. Pictures in other shapes show between black bars.",
    question: "What size should a YouTube thumbnail be?",
  },
  {
    answer:
      "The video's length sits over the bottom-right corner in every layout, so whatever is under it is hidden. Keep faces, text and logos out of that corner.",
    question: "Why does the length cover part of my thumbnail?",
  },
  {
    answer:
      "That's the size people see it at. On a laptop a thumbnail in the Up next column beside a video is about 288 pixels wide, and one on the home page about 360. When the window is too narrow, the page shrinks the whole mock and says by how much.",
    question: "Why does it look so small?",
  },
];

const STRUCTURED_DATA = pageStructuredData({
  application: {
    description: DESCRIPTION,
    features: [
      "Mock home page, search, Up next and phone layouts at real size",
      "Light and dark looks, with your title, channel, picture and video length",
      "Side by side with up to three other thumbnails",
      "Runs in the browser: no upload, no sign-up, no watermark",
    ],
    name: "Orcanva YouTube thumbnail preview",
  },
  faq: FAQ,
  name: "YouTube thumbnail preview",
  path: YOUTUBE_PREVIEW_PATH,
});

const YouTubeThumbnailPreviewPage = () => (
  <>
    <SiteNav />
    <main className="flex flex-col gap-20 pt-32 pb-20 md:gap-30 md:pt-36 md:pb-30">
      <Container className="flex flex-col gap-12">
        <PageIntro
          tag="Free · No sign-up · Nothing uploaded"
          title="Preview your YouTube thumbnail before you publish"
        >
          Drop in a thumbnail and see it at the size people scroll past it: on
          the home page, in search, beside a video and on a phone, in light and
          dark, next to up to three others. Add your title, channel and video
          length. Nothing leaves your device.
        </PageIntro>
        <div className="mx-auto w-full max-w-6xl">
          <YouTubePreviewTool />
        </div>
      </Container>
      <Container>
        <CardList heading="What you can check" id="checks" items={CHECKS} />
      </Container>
      <Container>
        <CardList heading="How it works" id="steps" items={STEPS} ordered />
      </Container>
      <Container>
        <section
          aria-labelledby="editor-heading"
          className="bg-muted flex flex-col items-center gap-6 rounded-4xl px-6 py-16 text-center md:py-20"
        >
          <h2
            id="editor-heading"
            className="font-heading text-heading md:text-heading-lg max-w-2xl font-normal text-balance"
          >
            Make the thumbnail in Orcanva, and preview it as you go
          </h2>
          <p className="text-muted-foreground max-w-xl text-lg text-pretty">
            Orcanva&apos;s editor has this preview built in: press Preview to
            see your design in every layout while you work on it, then download
            it at exactly 1280×720. Free, with a Google or email account.
          </p>
          <a
            href={newDesignPath("youtube-thumbnail")}
            rel="nofollow"
            className={buttonVariants({ className: "mt-2", size: "xl" })}
          >
            Make a thumbnail
            <RiArrowRightLine data-icon="inline-end" />
          </a>
        </section>
      </Container>
      <Container>
        <Faq entries={FAQ} />
      </Container>
      <Container>
        <RelatedPages current={YOUTUBE_PREVIEW_PATH} />
      </Container>
    </main>
    <SiteFooter />
    <JsonLd data={STRUCTURED_DATA} />
  </>
);

export default YouTubeThumbnailPreviewPage;
