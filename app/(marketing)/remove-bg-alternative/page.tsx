import { RiArrowRightLine } from "@remixicon/react";
import type { Metadata } from "next";
import Link from "next/link";

import { CardList } from "@/components/landing/card-list";
import { ComparisonTable } from "@/components/landing/comparison-table";
import type { ComparisonRow } from "@/components/landing/comparison-table";
import { Container } from "@/components/landing/container";
import { Faq } from "@/components/landing/faq";
import { PageIntro } from "@/components/landing/page-intro";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteNav } from "@/components/landing/site-nav";
import { JsonLd } from "@/components/seo/json-ld";
import { buttonVariants } from "@/components/ui/button";
import {
  BACKGROUND_REMOVER_PATH,
  CANVA_ALTERNATIVE_PATH,
  REMOVE_BG_ALTERNATIVE_PATH,
} from "@/lib/routes";
import { pageStructuredData } from "@/lib/seo/structured-data";
import type { FaqEntry } from "@/lib/seo/structured-data";

export const metadata: Metadata = {
  alternates: { canonical: REMOVE_BG_ALTERNATIVE_PATH },
  description:
    "remove.bg's own site closes on 1 December 2026 and moves into Canva. Orcanva's background remover is free, needs no account, and runs in your browser.",
  title: "A free remove.bg alternative, no sign-up",
};

// What remove.bg announced in September 2026 for 1 December
const CHANGES = [
  {
    body: "From 1 December 2026 remove.bg's website stops removing backgrounds and sends people to Canva, where the Background Remover is part of the paid plans.",
    title: "The site closes",
  },
  {
    body: "Unused remove.bg credits can't be spent after that date, and they don't carry over to Canva.",
    title: "Credits expire",
  },
  {
    body: "The self-service API stops as well. For developers, remove.bg points to Leonardo.AI's API instead.",
    title: "The API ends",
  },
];

const ROWS: ComparisonRow[] = [
  { feature: "Price", ours: "Free, no limit", theirs: "Paid plans" },
  { feature: "Account", ours: "Not needed", theirs: "Needed" },
  {
    feature: "Where your photo goes",
    ours: "Nowhere: it's processed on your device",
    theirs: "Uploaded to Canva",
  },
  {
    feature: "Result",
    ours: "Transparent PNG at full size",
    theirs: "Transparent PNG, on paid plans",
  },
];

const LIMITS = [
  {
    body: "It runs on WebGPU, which recent Chrome, Edge and Safari have. Older browsers and some phones can't run it, and the page tells you so.",
    title: "It needs a recent browser",
  },
  {
    body: "The first image downloads the AI model, about 220 MB. Your browser keeps it, so later images take a few seconds.",
    title: "The first run takes longer",
  },
  {
    body: "Orcanva has no API, so it can't stand in for remove.bg inside your scripts or apps. It's for people removing backgrounds by hand.",
    title: "There's no API",
  },
];

const FAQ: FaqEntry[] = [
  {
    answer:
      "remove.bg says its standalone website and self-service API end on 1 December 2026, and that background removal moves into Canva, its owner since 2021.",
    question: "When does remove.bg shut down?",
  },
  {
    answer:
      "remove.bg says unused credits expire on 1 December 2026. They aren't refunded and don't move to Canva.",
    question: "What happens to my remove.bg credits?",
  },
  {
    answer:
      "Orcanva uses BEN2, a recent open model built for fine edges like hair and fur. Try it on your own photos: it's free, and nothing is uploaded.",
    question: "How good are the cutouts?",
  },
  {
    answer:
      "One image at a time. Once the model is loaded, each takes a few seconds.",
    question: "Can I remove backgrounds in bulk?",
  },
  {
    answer:
      "No. The background remover works without one. You only sign up, free, to keep designs in Orcanva's editor.",
    question: "Do I need an account?",
  },
];

const STRUCTURED_DATA = pageStructuredData({
  faq: FAQ,
  name: "remove.bg alternative",
  path: REMOVE_BG_ALTERNATIVE_PATH,
});

const headingClass =
  "font-heading text-heading md:text-heading-lg max-w-2xl font-normal text-balance";

const RemoveBgAlternativePage = () => (
  <>
    <SiteNav />
    <main className="flex flex-col gap-20 pt-32 pb-20 md:gap-30 md:pt-36 md:pb-30">
      <Container>
        <PageIntro
          tag="remove.bg alternative"
          title="A free remove.bg alternative"
          actions={
            <Link
              href={BACKGROUND_REMOVER_PATH}
              className={buttonVariants({ size: "xl" })}
            >
              Remove a background
              <RiArrowRightLine data-icon="inline-end" />
            </Link>
          }
        >
          remove.bg&apos;s own site closes on 1 December 2026, and its
          background removal moves into Canva&apos;s paid plans. Orcanva&apos;s
          background remover is free, needs no account, and runs in your
          browser.
        </PageIntro>
      </Container>
      <Container>
        <CardList
          heading="What's changing at remove.bg"
          id="changes"
          items={CHANGES}
        />
      </Container>
      <Container>
        <section
          aria-labelledby="compare-heading"
          className="flex flex-col gap-10"
        >
          <h2 id="compare-heading" className={headingClass}>
            Orcanva and Canva&apos;s Background Remover
          </h2>
          <ComparisonTable
            them="Canva"
            rows={ROWS}
            caption="Canva's plans as of November 2026. Check canva.com for what they include today."
          />
        </section>
      </Container>
      <Container>
        <CardList heading="Good to know" id="limits" items={LIMITS} />
      </Container>
      <Container className="flex flex-col gap-10">
        <Faq entries={FAQ} />
        <p className="text-muted-foreground text-sm">
          Need more than cutouts? See how Orcanva compares as a{" "}
          <Link
            href={CANVA_ALTERNATIVE_PATH}
            className="hover:text-foreground underline underline-offset-4"
          >
            free Canva alternative
          </Link>
          . remove.bg and Canva are trademarks of their owners; Orcanva
          isn&apos;t affiliated with either.
        </p>
      </Container>
    </main>
    <SiteFooter />
    <JsonLd data={STRUCTURED_DATA} />
  </>
);

export default RemoveBgAlternativePage;
