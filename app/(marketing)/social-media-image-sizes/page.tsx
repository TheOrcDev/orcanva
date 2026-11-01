import type { Metadata } from "next";
import Link from "next/link";

import { Container } from "@/components/landing/container";
import { Faq } from "@/components/landing/faq";
import { PageIntro } from "@/components/landing/page-intro";
import { RelatedPages } from "@/components/landing/related-pages";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteNav } from "@/components/landing/site-nav";
import { JsonLd } from "@/components/seo/json-ld";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SIZE_PRESETS } from "@/lib/document/presets";
import { MAX_CANVAS_SIZE, MIN_CANVAS_SIZE } from "@/lib/document/schema";
import { IMAGE_SIZES_PATH, newDesignPath } from "@/lib/routes";
import { aspectRatio } from "@/lib/seo/aspect-ratio";
import { sizePageFor, sizePagePath } from "@/lib/seo/size-pages";
import { pageStructuredData } from "@/lib/seo/structured-data";
import type { FaqEntry } from "@/lib/seo/structured-data";

export const metadata: Metadata = {
  alternates: { canonical: IMAGE_SIZES_PATH },
  description:
    "Social media image sizes in pixels: YouTube thumbnails 1280×720, Instagram posts 1080×1080 and 1080×1350, Stories 1080×1920, LinkedIn banners 1584×396 and more.",
  title: "Social media image sizes: the cheat sheet",
};

const FAQ: FaqEntry[] = [
  {
    answer:
      "1280×720 pixels (16:9). YouTube asks for at least 640 pixels wide; 1280×720 is what it recommends.",
    question: "What size is a YouTube thumbnail?",
  },
  {
    answer:
      "1080×1080 for a square post and 1080×1350 for a portrait one (4:5). Stories and Reels are 1080×1920.",
    question: "What size is an Instagram post?",
  },
  {
    answer:
      "1200×630 pixels, about 1.9:1. X, LinkedIn, Facebook, Slack and Discord all show link previews in that shape.",
    question: "What size is a link preview (Open Graph) image?",
  },
  {
    answer: `Yes. Orcanva takes any width and height from ${MIN_CANVAS_SIZE} to ${MAX_CANVAS_SIZE} pixels, and you can resize a design later.`,
    question: "Can I use a size that isn't listed?",
  },
];

const STRUCTURED_DATA = pageStructuredData({
  faq: FAQ,
  name: "Social media image sizes",
  path: IMAGE_SIZES_PATH,
});

const linkClass = "hover:text-foreground underline underline-offset-4";

// Every preset the editor has, read from it, so the table never drifts
const ImageSizesPage = () => (
  <>
    <SiteNav />
    <main className="flex flex-col gap-20 pt-32 pb-20 md:gap-30 md:pt-36 md:pb-30">
      <Container>
        <PageIntro tag="Cheat sheet" title="Social media image sizes">
          Every size Orcanva has a preset for, in pixels and as a ratio. Open
          any of them as a blank canvas in one click, free.
        </PageIntro>
      </Container>
      <Container>
        <div className="bg-card ring-foreground/10 rounded-3xl p-3 ring-1 sm:p-5">
          <Table>
            <TableCaption>
              Sizes in pixels, width × height. Each downloads as PNG, JPG or
              WebP, at 1× or 2×.
            </TableCaption>
            <TableHeader>
              <TableRow>
                <TableHead>Size</TableHead>
                <TableHead>For</TableHead>
                <TableHead>Pixels</TableHead>
                <TableHead>Ratio</TableHead>
                <TableHead>
                  <span className="sr-only">Links</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SIZE_PRESETS.map((preset) => {
                const page = sizePageFor(preset.id);
                return (
                  <TableRow key={preset.id}>
                    <TableHead scope="row">{preset.label}</TableHead>
                    <TableCell>
                      <span className="text-muted-foreground">
                        {preset.description}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="tabular-nums">
                        {preset.width} × {preset.height}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="tabular-nums">
                        {aspectRatio(preset.width, preset.height)}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="text-muted-foreground flex gap-4">
                        <a
                          href={newDesignPath(preset.id)}
                          rel="nofollow"
                          className={linkClass}
                        >
                          Make one
                        </a>
                        {page ? (
                          <Link href={sizePagePath(page)} className={linkClass}>
                            {page.name}
                          </Link>
                        ) : null}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </Container>
      <Container>
        <Faq entries={FAQ} />
      </Container>
      <Container>
        <RelatedPages current={IMAGE_SIZES_PATH} />
      </Container>
    </main>
    <SiteFooter />
    <JsonLd data={STRUCTURED_DATA} />
  </>
);

export default ImageSizesPage;
