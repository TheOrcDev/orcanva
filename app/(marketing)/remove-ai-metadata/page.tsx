import { RiArrowRightLine } from "@remixicon/react";
import type { Metadata } from "next";
import Link from "next/link";

import { CardList } from "@/components/landing/card-list";
import { Container } from "@/components/landing/container";
import { Faq } from "@/components/landing/faq";
import { MetadataRemoverTool } from "@/components/landing/metadata-remover-tool";
import { PageIntro } from "@/components/landing/page-intro";
import { RelatedPages } from "@/components/landing/related-pages";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteNav } from "@/components/landing/site-nav";
import { JsonLd } from "@/components/seo/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { REMOVE_AI_METADATA_PATH, STUDIO_PATH } from "@/lib/routes";
import { pageStructuredData } from "@/lib/seo/structured-data";
import type { FaqEntry } from "@/lib/seo/structured-data";

const DESCRIPTION =
  "Strip Content Credentials (C2PA), AI tags, EXIF and GPS from JPG, PNG and WebP images. Instant and lossless, in your browser: nothing is uploaded.";

export const metadata: Metadata = {
  alternates: { canonical: REMOVE_AI_METADATA_PATH },
  description: DESCRIPTION,
  title: "Remove AI metadata from images, free",
};

const REMOVED = [
  {
    body: "The signed record ChatGPT, Adobe Firefly, Photoshop's generative tools and some phone cameras attach. Instagram, Threads, Facebook, TikTok and LinkedIn read it to label an image.",
    title: "Content Credentials (C2PA)",
  },
  {
    body: "The IPTC “digital source type” that says an image was generated or edited by AI. Meta reads it too.",
    title: "The “AI generated” tag",
  },
  {
    body: "Stable Diffusion, ComfyUI and InvokeAI save the prompt, seed and model inside the PNG, for anyone who downloads it to read.",
    title: "Prompts and settings",
  },
  {
    body: "EXIF: the camera or phone, the date, the software, and GPS coordinates saying where a photo was taken.",
    title: "Camera details and location",
  },
  {
    body: "XMP editing history, IPTC captions, comments, thumbnails and data hidden after the end of the image.",
    title: "Everything else",
  },
  {
    body: "Every pixel, the colour profile and the photo's rotation. A JPG isn't compressed again, so no quality is lost.",
    title: "What stays: the picture",
  },
];

const STEPS = [
  {
    body: "Choose a JPG, PNG or WebP, drop it on the box, or paste it from your clipboard.",
    title: "Add an image",
  },
  {
    body: "Your browser copies the parts of the file that make up the picture and leaves the rest out. It takes a moment: no upload, no AI model.",
    title: "It's cleaned in place",
  },
  {
    body: "Download the clean copy, or on your phone share it straight to the app you post from.",
    title: "Download or share it",
  },
];

const FAQ: FaqEntry[] = [
  {
    answer:
      "Not from the file's metadata. Instagram, Threads and Facebook read Content Credentials and the IPTC AI tag, and both are removed. Some AI tools also hide an invisible watermark in the pixels, like Google's SynthID. Removing metadata doesn't touch it, so a platform that reads those can still tell.",
    question: "Will Instagram still show “AI info”?",
  },
  {
    answer:
      "Removing metadata doesn't change a platform's rules. Some, like TikTok, ask you to label realistic AI-generated content yourself, so check the rules where you post.",
    question: "Do I still need to say an image was made with AI?",
  },
  {
    answer:
      "No. Your browser reads the file and writes the clean copy on your device. Nothing is sent to a server.",
    question: "Is my image uploaded anywhere?",
  },
  {
    answer:
      "No. The image data is copied as it is, so a JPG isn't compressed again and every pixel stays the same. The colour profile and the photo's rotation are kept too.",
    question: "Does it lower the quality?",
  },
  {
    answer:
      "JPG, PNG and WebP are cleaned without touching the picture. Other images your browser can open, like GIF, are redrawn instead: only the picture is kept (a GIF keeps its first frame), and the page says when that happens.",
    question: "Which files does it work with?",
  },
  {
    answer:
      "A signed record of where an image came from and how it was edited, from the C2PA standard. ChatGPT, Adobe Firefly, Photoshop's generative tools and some phone cameras add them, and Instagram, Facebook, Threads, TikTok and LinkedIn read them to label images.",
    question: "What are Content Credentials?",
  },
  {
    answer:
      "Yes, with no limit, no sign-up and no watermark. It all runs on your device, so it costs nothing to run.",
    question: "Is it free?",
  },
];

const STRUCTURED_DATA = pageStructuredData({
  application: {
    description: DESCRIPTION,
    features: [
      "Removes Content Credentials (C2PA), IPTC AI tags, AI prompts, EXIF, GPS and XMP",
      "Lossless for JPG, PNG and WebP: the picture isn't encoded again",
      "Runs in the browser: no upload, no sign-up, no watermark",
    ],
    name: "Orcanva AI metadata remover",
  },
  faq: FAQ,
  name: "AI metadata remover",
  path: REMOVE_AI_METADATA_PATH,
});

const RemoveAiMetadataPage = () => (
  <>
    <SiteNav />
    <main className="flex flex-col gap-20 pt-32 pb-20 md:gap-30 md:pt-36 md:pb-30">
      <Container className="flex flex-col gap-12">
        <PageIntro
          tag="Free · Instant · Nothing uploaded"
          title="Remove AI metadata from any image"
        >
          Drop in an image and download the same picture without its Content
          Credentials, AI tags, prompt, camera details or location. Every pixel
          stays as it was, and the file never leaves your device.
        </PageIntro>
        <div className="mx-auto w-full max-w-4xl">
          <MetadataRemoverTool />
        </div>
      </Container>
      <Container>
        <CardList heading="What it removes" id="removed" items={REMOVED} />
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
            Images made in Orcanva come out clean
          </h2>
          <p className="text-muted-foreground max-w-xl text-lg text-pretty">
            Every image you export from Orcanva&apos;s editor is drawn fresh, so
            it carries none of this metadata. Put your picture on a YouTube
            thumbnail or a post, add bold text, and download it at the exact
            size. Free, with a Google or email account.
          </p>
          <Link
            href={STUDIO_PATH}
            className={buttonVariants({ className: "mt-2", size: "xl" })}
          >
            Open Studio
            <RiArrowRightLine data-icon="inline-end" />
          </Link>
        </section>
      </Container>
      <Container>
        <Faq entries={FAQ} />
      </Container>
      <Container>
        <RelatedPages current={REMOVE_AI_METADATA_PATH} />
      </Container>
    </main>
    <SiteFooter />
    <JsonLd data={STRUCTURED_DATA} />
  </>
);

export default RemoveAiMetadataPage;
