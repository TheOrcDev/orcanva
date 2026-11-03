import { RiArrowRightLine } from "@remixicon/react";
import type { Metadata } from "next";
import Link from "next/link";

import { CardList } from "@/components/landing/card-list";
import { ClosingCta } from "@/components/landing/closing-cta";
import { ComparisonTable } from "@/components/landing/comparison-table";
import type { ComparisonRow } from "@/components/landing/comparison-table";
import { Container } from "@/components/landing/container";
import { Faq } from "@/components/landing/faq";
import { PageIntro } from "@/components/landing/page-intro";
import { ProductFrame } from "@/components/landing/product-frame";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteNav } from "@/components/landing/site-nav";
import { JsonLd } from "@/components/seo/json-ld";
import { buttonVariants } from "@/components/ui/button";
import { FONT_CATALOG } from "@/lib/fonts/catalog";
import {
  BACKGROUND_REMOVER_PATH,
  CANVA_ALTERNATIVE_PATH,
  STUDIO_PATH,
} from "@/lib/routes";
import { pageStructuredData } from "@/lib/seo/structured-data";
import type { FaqEntry } from "@/lib/seo/structured-data";
import { TEMPLATES } from "@/lib/templates/catalog";

export const metadata: Metadata = {
  alternates: { canonical: CANVA_ALTERNATIVE_PATH },
  description:
    "Looking for a free Canva alternative? Orcanva makes YouTube thumbnails and social images, with free background removal, transparent PNGs and live collaboration.",
  title: "The free Canva alternative for thumbnails",
};

// Canva's side as its plans stood when this was written; the caption says so
const ROWS: ComparisonRow[] = [
  {
    feature: "Price",
    ours: "Free, every feature",
    theirs: "Free, with paid plans for more",
  },
  {
    feature: "Open source",
    ours: "Yes, MIT-licensed on GitHub",
    theirs: "No",
  },
  {
    feature: "Background remover",
    ours: "Free and unlimited, in your browser",
    theirs: "Paid plans",
  },
  {
    feature: "Transparent PNG download",
    ours: "Free",
    theirs: "Paid plans",
  },
  {
    feature: "Live collaboration",
    ours: "Free, guests included on public designs",
    theirs: "Free",
  },
  {
    feature: "Fonts",
    ours: `${FONT_CATALOG.length} curated Google Fonts`,
    theirs: "Thousands, more on paid plans",
  },
  {
    feature: "Export",
    ours: "PNG, JPG or WebP at the exact size, 1× or 2×",
    theirs: "PNG, JPG, PDF and more",
  },
  {
    feature: "Templates",
    ours: `${TEMPLATES.length} starter templates, and public designs to copy`,
    theirs: "Hundreds of thousands",
  },
  {
    feature: "Stock photos",
    ours: "None: bring your own images",
    theirs: "A large library",
  },
  {
    feature: "Video, presentations, print",
    ours: "No, still images only",
    theirs: "Yes",
  },
  {
    feature: "Apps",
    ours: "Any recent browser",
    theirs: "Browser, desktop and mobile apps",
  },
];

const FOR_WHOM = [
  {
    body: "Thumbnails at 1280×720 with bold, outlined text, your face cut out of any photo, and a file that's ready to upload.",
    title: "YouTubers",
  },
  {
    body: "Square, portrait and Story sizes, plus X and LinkedIn, each exact to the pixel and exported in one click.",
    title: "Social media posts",
  },
  {
    body: "Open Graph images at 1200×630 for every page you ship, without opening a heavyweight design tool.",
    title: "Developers",
  },
];

const FAQ: FaqEntry[] = [
  {
    answer:
      "Yes. There's no paid plan: every feature, background removal included, is free. It's open source too, under the MIT licence on GitHub. You sign up with Google or email to keep your designs.",
    question: "Is Orcanva really free?",
  },
  {
    answer:
      "No. Orcanva is an independent project. It isn't affiliated with, or endorsed by, Canva.",
    question: "Is Orcanva made by Canva?",
  },
  {
    answer:
      "Not directly. Download a design from Canva as a PNG and drop it into Orcanva, or rebuild it at the same size: the presets match the usual ones, like 1280×720 for YouTube and 1080×1920 for Stories.",
    question: "Can I bring my Canva designs over?",
  },
  {
    answer: `A small set: ${TEMPLATES.length} free starter templates for thumbnails and social posts, with frames to drop your photos into, not a library like Canva's. Anyone can also open the public designs in the studio, and Make a copy gives you a private one to change.`,
    question: "Does Orcanva have templates?",
  },
  {
    answer:
      "Yes. Make a design public and anyone with the link can edit it with you, live, with or without an account. Yours stay private until you choose otherwise.",
    question: "Can I design together with others?",
  },
  {
    answer:
      "Yes. The fonts are Google Fonts under open licences, the background-removal model is MIT-licensed, and your designs are yours.",
    question: "Can I use my designs commercially?",
  },
];

const STRUCTURED_DATA = pageStructuredData({
  faq: FAQ,
  name: "Canva alternative",
  path: CANVA_ALTERNATIVE_PATH,
});

const CanvaAlternativePage = () => (
  <>
    <SiteNav />
    <main className="flex flex-col gap-20 pt-32 md:gap-30 md:pt-36">
      <Container className="flex flex-col gap-12">
        <PageIntro
          tag="Orcanva vs Canva"
          title="The free Canva alternative for thumbnails and social images"
          actions={
            <>
              <Link
                href={STUDIO_PATH}
                className={buttonVariants({ size: "xl" })}
              >
                Open Studio
                <RiArrowRightLine data-icon="inline-end" />
              </Link>
              <Link
                href={BACKGROUND_REMOVER_PATH}
                className={buttonVariants({ size: "xl", variant: "outline" })}
              >
                Try the background remover
              </Link>
            </>
          }
        >
          Orcanva does one job well: images at the exact size you need, made
          fast. Background removal and transparent PNGs, paid extras on Canva,
          are free here, along with live collaboration.
        </PageIntro>
      </Container>
      <ProductFrame />
      <Container>
        <section
          aria-labelledby="compare-heading"
          className="flex flex-col gap-10"
        >
          <h2
            id="compare-heading"
            className="font-heading text-heading md:text-heading-lg max-w-2xl font-normal text-balance"
          >
            Orcanva and Canva, side by side
          </h2>
          <ComparisonTable
            them="Canva Free"
            rows={ROWS}
            caption="Canva's plans as of November 2026. Check canva.com for what they include today."
          />
        </section>
      </Container>
      <Container>
        <CardList heading="Who it's for" id="for-whom" items={FOR_WHOM} />
      </Container>
      <Container>
        <section
          aria-labelledby="canva-heading"
          className="flex max-w-3xl flex-col gap-4"
        >
          <h2
            id="canva-heading"
            className="font-heading text-heading font-normal text-balance"
          >
            When Canva is the better choice
          </h2>
          <p className="text-muted-foreground text-body-lg text-pretty">
            If you need ready-made templates for everything, stock photos, video
            editing, presentations or print, Canva does far more than Orcanva,
            which sticks to still images for screens. If you make thumbnails and
            social posts from your own photos, Orcanva gets you there without a
            subscription.
          </p>
        </section>
      </Container>
      <Container className="flex flex-col gap-10">
        <Faq entries={FAQ} />
        <p className="text-muted-foreground text-sm">
          Canva is a trademark of Canva Pty Ltd. Orcanva isn&apos;t affiliated
          with or endorsed by Canva.
        </p>
      </Container>
      <ClosingCta />
    </main>
    <SiteFooter />
    <JsonLd data={STRUCTURED_DATA} />
  </>
);

export default CanvaAlternativePage;
