import type { Metadata } from "next";

import { Container } from "@/components/landing/container";
import { Faq } from "@/components/landing/faq";
import { PageIntro } from "@/components/landing/page-intro";
import { RelatedPages } from "@/components/landing/related-pages";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteNav } from "@/components/landing/site-nav";
import { JsonLd } from "@/components/seo/json-ld";
import { TemplateGrid } from "@/components/templates/template-grid";
import { buttonVariants } from "@/components/ui/button";
import { SIZE_PRESETS } from "@/lib/document/presets";
import { formatSize } from "@/lib/format";
import { TEMPLATES_PATH } from "@/lib/routes";
import { pageStructuredData } from "@/lib/seo/structured-data";
import type { FaqEntry } from "@/lib/seo/structured-data";
import { TEMPLATES } from "@/lib/templates/catalog";
import { templatesForPreset } from "@/lib/templates/lookup";

const DESCRIPTION = `${TEMPLATES.length} free templates for YouTube thumbnails, Instagram posts and Stories, X posts, LinkedIn banners and Open Graph images. Pick one, drop in your photos, change the words and download, with no watermark.`;

export const metadata: Metadata = {
  alternates: { canonical: TEMPLATES_PATH },
  description: DESCRIPTION,
  title: "Free templates for thumbnails and social posts",
};

// Every size with templates, in the size picker's order
const GROUPS = SIZE_PRESETS.flatMap((preset) => {
  const templates = templatesForPreset(preset.id);
  return templates.length > 0 ? [{ preset, templates }] : [];
});

const FAQ: FaqEntry[] = [
  {
    answer:
      "Yes, every one, with no watermark. Pick one and it opens as a new design in your account; sign up with Google or email first if you haven't.",
    question: "Are the templates free?",
  },
  {
    answer:
      "Templates leave grey frames where photos go. Drop a photo from your computer or the Uploads tab onto one and it fills the frame; double-click it to move or zoom the photo inside.",
    question: "How do I put my own photo in?",
  },
  {
    answer:
      "Yes. The templates, their stickers and the paintings in some of them are Orcanva's own, and the fonts are Google Fonts under open licences, so what you make is yours to use.",
    question: "Can I use them commercially?",
  },
  {
    answer:
      "Each template opens at the size it was made for. Resize the canvas afterwards, or open the editor's Templates tab to replace a page with any template, or add one to a page of another size, where it's scaled to fit.",
    question: "Can I use a template at another size?",
  },
];

const STRUCTURED_DATA = pageStructuredData({
  faq: FAQ,
  items: {
    list: TEMPLATES.map((template) => ({
      description: `${template.category} template, ${formatSize(template.width, template.height)} px`,
      image: template.preview,
      name: template.name,
    })),
    name: "Orcanva templates",
  },
  name: "Templates",
  path: TEMPLATES_PATH,
});

const TemplatesPage = () => (
  <>
    <SiteNav />
    <main className="flex flex-col gap-20 pt-32 pb-20 md:gap-30 md:pt-36 md:pb-30">
      <Container className="flex flex-col gap-10">
        <PageIntro
          tag={`Free · ${TEMPLATES.length} templates`}
          title="Free templates for thumbnails and social posts"
        >
          Start from a design instead of a blank canvas. Pick a template, drop
          your photos into its frames, change the words and download it at
          exactly the right size.
        </PageIntro>
        <nav aria-label="Template sizes">
          <ul className="flex flex-wrap justify-center gap-2">
            {GROUPS.map(({ preset }) => (
              <li key={preset.id}>
                <a
                  href={`#${preset.id}`}
                  className={buttonVariants({ size: "sm", variant: "outline" })}
                >
                  {preset.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
      {GROUPS.map(({ preset, templates }) => (
        <Container key={preset.id}>
          <section
            id={preset.id}
            aria-labelledby={`${preset.id}-heading`}
            className="flex scroll-mt-28 flex-col gap-8"
          >
            <div className="flex flex-col gap-1">
              <h2
                id={`${preset.id}-heading`}
                className="font-heading text-heading font-normal text-balance"
              >
                {preset.label}
              </h2>
              <p className="text-muted-foreground">
                {formatSize(preset.width, preset.height)} px
                {preset.description === preset.label
                  ? null
                  : ` · ${preset.description}`}
              </p>
            </div>
            <TemplateGrid templates={templates} />
          </section>
        </Container>
      ))}
      <Container>
        <Faq entries={FAQ} />
      </Container>
      <Container>
        <RelatedPages current={TEMPLATES_PATH} />
      </Container>
    </main>
    <SiteFooter />
    <JsonLd data={STRUCTURED_DATA} />
  </>
);

export default TemplatesPage;
