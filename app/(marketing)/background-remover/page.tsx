import { RiArrowRightLine } from "@remixicon/react";
import type { Metadata } from "next";
import Link from "next/link";

import { BackgroundRemoverTool } from "@/components/landing/background-remover-tool";
import { CardList } from "@/components/landing/card-list";
import { Container } from "@/components/landing/container";
import { Faq } from "@/components/landing/faq";
import { PageIntro } from "@/components/landing/page-intro";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteNav } from "@/components/landing/site-nav";
import { JsonLd } from "@/components/seo/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { BACKGROUND_REMOVER_PATH, STUDIO_PATH } from "@/lib/routes";
import { pageStructuredData } from "@/lib/seo/structured-data";
import type { FaqEntry } from "@/lib/seo/structured-data";

const DESCRIPTION =
  "Remove the background from any photo, free. The AI runs in your browser, so nothing is uploaded: no sign-up, no credits, no watermark, just a transparent PNG.";

export const metadata: Metadata = {
  alternates: { canonical: BACKGROUND_REMOVER_PATH },
  description: DESCRIPTION,
  title: "Free background remover, no sign-up",
};

const STEPS = [
  {
    body: "Choose a JPG, PNG, WebP or GIF, drop it on the box, or paste it from your clipboard.",
    title: "Add a photo",
  },
  {
    body: "BEN2, an open AI model, finds the subject on your own device's GPU. The first time, your browser downloads it (about 220 MB) and keeps it.",
    title: "The AI cuts it out",
  },
  {
    body: "At your photo's full size, with soft edges kept around hair and fur, and no watermark.",
    title: "Download a transparent PNG",
  },
];

const FAQ: FaqEntry[] = [
  {
    answer:
      "Yes. The AI runs on your own device, so a removal costs nothing to make: no limit, no credits, no watermark and no account.",
    question: "Is it really free?",
  },
  {
    answer:
      "No. On this page your photo is read by your browser and processed on your device. The only download is the AI model itself, from Hugging Face.",
    question: "Is my photo uploaded anywhere?",
  },
  {
    answer:
      "It needs WebGPU and a graphics chip with half-precision support, which recent Chrome, Edge and Safari have. If yours can't run it, the page says so.",
    question: "Which browsers does it work in?",
  },
  {
    answer:
      "The first removal downloads the AI model, about 220 MB. Your browser keeps it, so from then on each image takes a few seconds.",
    question: "Why is the first image slow?",
  },
  {
    answer:
      "A PNG the same size as your photo, with a transparent background. Where the model is unsure, like strands of hair, the edge stays soft.",
    question: "What do I get?",
  },
  {
    answer:
      "Yes. The model's weights are MIT-licensed, and the picture is yours to use however you like.",
    question: "Can I use the result commercially?",
  },
];

const STRUCTURED_DATA = pageStructuredData({
  application: {
    description: DESCRIPTION,
    features: [
      "Background removal by an AI model running in the browser",
      "Transparent PNG at the original size",
      "No upload, no sign-up, no credits, no watermark",
    ],
    name: "Orcanva background remover",
  },
  faq: FAQ,
  name: "Background remover",
  path: BACKGROUND_REMOVER_PATH,
});

const BackgroundRemoverPage = () => (
  <>
    <SiteNav />
    <main className="flex flex-col gap-20 pt-32 pb-20 md:gap-30 md:pt-36 md:pb-30">
      <Container className="flex flex-col gap-12">
        <PageIntro
          tag="Free · No sign-up · No watermark"
          title="Remove the background from any image"
        >
          Drop in a photo and download it as a transparent PNG. The AI runs in
          your browser, so your photo never leaves your device, and there are no
          credits to buy.
        </PageIntro>
        <div className="mx-auto w-full max-w-4xl">
          <BackgroundRemoverTool editorHref={STUDIO_PATH} />
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
            Then put your cutout to work
          </h2>
          <p className="text-muted-foreground max-w-xl text-lg text-pretty">
            In Orcanva&apos;s editor the same one-click removal works on every
            image you add. Put your subject on a YouTube thumbnail or a Story,
            add bold text, and export at the exact size. Free, with a Google or
            email account.
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
    </main>
    <SiteFooter />
    <JsonLd data={STRUCTURED_DATA} />
  </>
);

export default BackgroundRemoverPage;
