import { RiArrowRightLine } from "@remixicon/react";
import type { Metadata } from "next";
import Link from "next/link";

import { CardList } from "@/components/landing/card-list";
import { Container } from "@/components/landing/container";
import { Faq } from "@/components/landing/faq";
import { MagicEraserTool } from "@/components/landing/magic-eraser-tool";
import { PageIntro } from "@/components/landing/page-intro";
import { RelatedPages } from "@/components/landing/related-pages";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteNav } from "@/components/landing/site-nav";
import { JsonLd } from "@/components/seo/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { MAGIC_ERASER_PATH, STUDIO_PATH } from "@/lib/routes";
import { pageStructuredData } from "@/lib/seo/structured-data";
import type { FaqEntry } from "@/lib/seo/structured-data";

const DESCRIPTION =
  "Remove objects, people, text and watermarks from a photo, free. Brush over them and AI fills the gap, in your browser: no upload, no sign-up, no watermark.";

export const metadata: Metadata = {
  alternates: { canonical: MAGIC_ERASER_PATH },
  description: DESCRIPTION,
  title: "Free magic eraser: remove objects from photos",
};

const STEPS = [
  {
    body: "Choose a JPG, PNG, WebP or GIF, drop it on the box, or paste it from your clipboard.",
    title: "Add a photo",
  },
  {
    body: "Paint over the thing to remove, with a little room around it. Change the brush size for small or big things.",
    title: "Brush over it",
  },
  {
    body: "LaMa, an open AI model, fills what you painted from what's around it, on your own device. The first time, your browser downloads it (about 37 MB) and keeps it.",
    title: "Press Erase",
  },
  {
    body: "Keep brushing and erasing until it's gone, step back with Undo, then download it at its full size. No watermark.",
    title: "Touch up and download",
  },
];

const FAQ: FaqEntry[] = [
  {
    answer:
      "Yes. The AI runs on your own device, so an erase costs nothing to make: no limit, no credits, no watermark and no account.",
    question: "Is it really free?",
  },
  {
    answer:
      "No. On this page your photo is read by your browser and filled in on your device. The only downloads are the AI model and its runtime, from Hugging Face and jsDelivr.",
    question: "Is my photo uploaded anywhere?",
  },
  {
    answer:
      "Things against a background it can continue: people and objects in a landscape or on a table, text, logos, watermarks, wires and blemishes. Where it has to invent a lot, like a face or a busy pattern, a second pass on what's left usually helps.",
    question: "What can it remove?",
  },
  {
    answer:
      "Any recent browser. With WebGPU (recent Chrome, Edge and Safari) an erase takes about a second; without it the model runs on one CPU core and takes several seconds.",
    question: "Which browsers does it work in?",
  },
  {
    answer:
      "Only what you paint changes, and the photo keeps its size. A PNG with a transparent background, like a cutout from the background remover, keeps its transparency.",
    question: "Does it change the rest of my photo?",
  },
  {
    answer:
      "The model is LaMa, by Roman Suvorov and others, and its weights are released under the Apache 2.0 licence, which allows commercial use. To be open about it: it was trained on Places2, a collection of photos whose own terms allow non-commercial research and education, and the weights' licence doesn't say how that carries over. The picture you make is yours.",
    question: "Can I use the result commercially?",
  },
];

const STRUCTURED_DATA = pageStructuredData({
  application: {
    description: DESCRIPTION,
    features: [
      "Object, text and watermark removal by an AI model running in the browser",
      "Brush, erase, undo and redo, at the photo's full size",
      "No upload, no sign-up, no credits, no watermark",
    ],
    name: "Orcanva magic eraser",
  },
  faq: FAQ,
  name: "Magic eraser",
  path: MAGIC_ERASER_PATH,
});

const MagicEraserPage = () => (
  <>
    <SiteNav />
    <main className="flex flex-col gap-20 pt-32 pb-20 md:gap-30 md:pt-36 md:pb-30">
      <Container className="flex flex-col gap-12">
        <PageIntro
          tag="Free · No sign-up · No watermark"
          title="Erase anything from a photo"
        >
          Brush over a person, an object, some text or a watermark, and AI fills
          the gap. It runs in your browser, so your photo never leaves your
          device, and there are no credits to buy.
        </PageIntro>
        <div className="mx-auto w-full max-w-4xl">
          <MagicEraserTool editorHref={STUDIO_PATH} />
        </div>
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
            Clean up photos right on your thumbnail
          </h2>
          <p className="text-muted-foreground max-w-xl text-lg text-pretty">
            In Orcanva&apos;s editor the same eraser works on every image you
            add, and its crop, filters and effects stay as they are. Then add
            bold text and export at the exact size. Free, with a Google or email
            account.
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
        <RelatedPages current={MAGIC_ERASER_PATH} />
      </Container>
    </main>
    <SiteFooter />
    <JsonLd data={STRUCTURED_DATA} />
  </>
);

export default MagicEraserPage;
