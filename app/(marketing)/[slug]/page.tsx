import { RiArrowRightLine } from "@remixicon/react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { CardList } from "@/components/landing/card-list";
import { Container } from "@/components/landing/container";
import { Faq } from "@/components/landing/faq";
import { PageIntro } from "@/components/landing/page-intro";
import { ProductFrame } from "@/components/landing/product-frame";
import { RelatedPages } from "@/components/landing/related-pages";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteNav } from "@/components/landing/site-nav";
import { SizeCards } from "@/components/landing/size-cards";
import { JsonLd } from "@/components/seo/json-ld";
import { TemplateGrid } from "@/components/templates/template-grid";
import { buttonVariants } from "@/components/ui/button";
import { FONT_CATALOG } from "@/lib/fonts/catalog";
import { TEMPLATES_PATH, newDesignPath } from "@/lib/routes";
import {
  SHARED_FAQ,
  SIZE_PAGES,
  findSizePage,
  presetsOf,
  sizePagePath,
} from "@/lib/seo/size-pages";
import type { SizePage } from "@/lib/seo/size-pages";
import { pageStructuredData } from "@/lib/seo/structured-data";
import { findTemplate } from "@/lib/templates/lookup";

// Only the pages in SIZE_PAGES exist; any other single-segment path is a 404
export const dynamicParams = false;

export const generateStaticParams = () =>
  SIZE_PAGES.map((page) => ({ slug: page.slug }));

const pageFor = async (props: PageProps<"/[slug]">): Promise<SizePage> => {
  const { slug } = await props.params;
  const page = findSizePage(slug);
  if (!page) {
    notFound();
  }
  return page;
};

export const generateMetadata = async (
  props: PageProps<"/[slug]">
): Promise<Metadata> => {
  const page = await pageFor(props);
  return {
    alternates: { canonical: sizePagePath(page) },
    description: page.description,
    title: page.title,
  };
};

const stepsFor = (page: SizePage) => {
  const [main] = presetsOf(page);
  const size = main ? `${main.width}×${main.height}` : "the right";
  return [
    {
      body: `Start from the ${main?.label ?? "preset"} canvas at exactly ${size} pixels, or any custom size.`,
      title: `Open a ${size} canvas`,
    },
    {
      body: `Upload, drag in or paste a photo, remove its background in one click, and write on it in any of ${FONT_CATALOG.length} fonts.`,
      title: "Add a photo and text",
    },
    {
      body: "PNG, JPG or WebP at exactly the canvas size, or at 2× for extra sharpness. No watermark.",
      title: "Download it",
    },
  ];
};

const SizePageView = async (props: PageProps<"/[slug]">) => {
  const page = await pageFor(props);
  const presets = presetsOf(page);
  const [main] = presets;
  const faq = [...page.faq, ...SHARED_FAQ];
  const path = sizePagePath(page);
  const templates = page.templates.flatMap((id) => findTemplate(id) ?? []);

  return (
    <>
      <SiteNav />
      <main className="flex flex-col gap-20 pt-32 pb-20 md:gap-30 md:pt-36 md:pb-30">
        <Container>
          <PageIntro
            tag={main ? `Free · ${main.width} × ${main.height} px` : "Free"}
            title={page.heading}
            actions={
              main ? (
                <a
                  href={newDesignPath(main.id)}
                  rel="nofollow"
                  className={buttonVariants({ size: "xl" })}
                >
                  {page.cta}
                  <RiArrowRightLine data-icon="inline-end" />
                </a>
              ) : null
            }
          >
            {page.lead}
          </PageIntro>
        </Container>
        <ProductFrame />
        <Container>
          <section
            aria-labelledby="size-heading"
            className="flex flex-col gap-10"
          >
            <h2
              id="size-heading"
              className="font-heading text-heading md:text-heading-lg max-w-2xl font-normal text-balance"
            >
              {presets.length > 1 ? "The sizes" : "The size"}
            </h2>
            <SizeCards presets={presets} />
            <p className="text-muted-foreground text-sm">
              Free. Sign up with Google or email to keep your designs.
            </p>
          </section>
        </Container>
        {templates.length > 0 ? (
          <Container>
            <section
              aria-labelledby="templates-heading"
              className="flex flex-col gap-10"
            >
              <div className="flex flex-wrap items-end justify-between gap-4">
                <h2
                  id="templates-heading"
                  className="font-heading text-heading md:text-heading-lg max-w-2xl font-normal text-balance"
                >
                  Start from a template
                </h2>
                <Link
                  href={TEMPLATES_PATH}
                  className={buttonVariants({ variant: "outline" })}
                >
                  All templates
                  <RiArrowRightLine data-icon="inline-end" />
                </Link>
              </div>
              <TemplateGrid templates={templates} />
            </section>
          </Container>
        ) : null}
        <Container>
          <CardList
            heading="How to make one"
            id="steps"
            items={stepsFor(page)}
            ordered
          />
        </Container>
        <Container>
          <CardList heading="Tips" id="tips" items={page.tips} />
        </Container>
        <Container>
          <Faq entries={faq} />
        </Container>
        <Container>
          <RelatedPages current={path} />
        </Container>
      </main>
      <SiteFooter />
      <JsonLd data={pageStructuredData({ faq, name: page.name, path })} />
    </>
  );
};

export default SizePageView;
