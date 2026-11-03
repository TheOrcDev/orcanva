import { RiArrowRightLine } from "@remixicon/react";
import type { Metadata } from "next";
import Link from "next/link";

import { CardList } from "@/components/landing/card-list";
import { Container } from "@/components/landing/container";
import { Faq } from "@/components/landing/faq";
import { ImageUpscalerTool } from "@/components/landing/image-upscaler-tool";
import { PageIntro } from "@/components/landing/page-intro";
import { RelatedPages } from "@/components/landing/related-pages";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteNav } from "@/components/landing/site-nav";
import { JsonLd } from "@/components/seo/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { IMAGE_UPSCALER_PATH, STUDIO_PATH } from "@/lib/routes";
import { pageStructuredData } from "@/lib/seo/structured-data";
import type { FaqEntry } from "@/lib/seo/structured-data";

const DESCRIPTION =
  "Upscale a photo or screenshot 2× or 4× with AI, free. It runs in your browser, so nothing is uploaded: no sign-up, no credits, no watermark.";

export const metadata: Metadata = {
  alternates: { canonical: IMAGE_UPSCALER_PATH },
  description: DESCRIPTION,
  title: "Free AI image upscaler, no sign-up",
};

const STEPS = [
  {
    body: "Choose a JPG, PNG, WebP or GIF, drop it on the box, or paste it from your clipboard.",
    title: "Add a photo",
  },
  {
    body: "Each choice shows the size it makes, up to 4096 pixels on the long side.",
    title: "Pick 2× or 4×",
  },
  {
    body: "Real-ESRGAN, an open AI model, sharpens edges and clears blur, noise and JPEG blocks on your own device. The first time, your browser downloads it (about 8 MB with its runtime) and keeps it.",
    title: "The AI enlarges it",
  },
  {
    body: "Drag the line to compare, then download it: a JPG, or a PNG when your image has transparency. No watermark.",
    title: "Compare and download",
  },
];

const FAQ: FaqEntry[] = [
  {
    answer:
      "Yes. The AI runs on your own device, so an upscale costs nothing to make: no limit, no credits, no watermark and no account.",
    question: "Is it really free?",
  },
  {
    answer:
      "No. On this page your image is read by your browser and enlarged on your device. The only downloads are the AI model and its runtime, from Hugging Face and jsDelivr.",
    question: "Is my image uploaded anywhere?",
  },
  {
    answer:
      "Up to 4096 pixels on the long side, and about 8.3 million pixels in all, which is a 4K frame. A 1280 × 720 thumbnail goes to 2560 × 1440 at 2×, or 3840 × 2160 at 4×.",
    question: "How big can it make an image?",
  },
  {
    answer:
      "Any recent browser. With WebGPU (recent Chrome, Edge and Safari) it takes a second or two; without it the model runs on one CPU core, which can take a minute or more for a big image.",
    question: "Which browsers does it work in?",
  },
  {
    answer:
      "No upscaler can bring back detail that isn't in the picture. Where the original is blurry, the model draws edges and texture that look right, so small faces and text can come out a little different: look at the result before you use it.",
    question: "Does it really add detail?",
  },
  {
    answer:
      "Yes. A photo with a transparent background, like a cutout from the background remover, keeps its transparency, edges included, and downloads as a PNG.",
    question: "Does it keep transparency?",
  },
  {
    answer:
      "Yes. The model is Real-ESRGAN by Xintao Wang and others, released under the BSD 3-Clause licence, and the picture is yours to use however you like.",
    question: "Can I use the result commercially?",
  },
];

const STRUCTURED_DATA = pageStructuredData({
  application: {
    description: DESCRIPTION,
    features: [
      "2× and 4× upscaling by an AI model running in the browser",
      "Up to 4096 pixels on the long side, transparency kept",
      "No upload, no sign-up, no credits, no watermark",
    ],
    name: "Orcanva image upscaler",
  },
  faq: FAQ,
  name: "Image upscaler",
  path: IMAGE_UPSCALER_PATH,
});

const ImageUpscalerPage = () => (
  <>
    <SiteNav />
    <main className="flex flex-col gap-20 pt-32 pb-20 md:gap-30 md:pt-36 md:pb-30">
      <Container className="flex flex-col gap-12">
        <PageIntro
          tag="Free · No sign-up · No watermark"
          title="Upscale images 2× or 4× with AI"
        >
          Make a small or blurry photo or screenshot bigger and sharper. The AI
          runs in your browser, so your image never leaves your device, and
          there are no credits to buy.
        </PageIntro>
        <div className="mx-auto w-full max-w-4xl">
          <ImageUpscalerTool editorHref={STUDIO_PATH} />
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
            Sharpen photos right on your thumbnail
          </h2>
          <p className="text-muted-foreground max-w-xl text-lg text-pretty">
            In Orcanva&apos;s editor the same upscaler is a click away on every
            image, and it tells you when a photo is too small for the space it
            fills. Its crop, filters and effects stay as they are. Free, with a
            Google or email account.
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
        <RelatedPages current={IMAGE_UPSCALER_PATH} />
      </Container>
    </main>
    <SiteFooter />
    <JsonLd data={STRUCTURED_DATA} />
  </>
);

export default ImageUpscalerPage;
