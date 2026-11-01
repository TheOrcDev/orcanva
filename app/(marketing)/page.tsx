import type { Metadata } from "next";

import { ClosingCta } from "@/components/landing/closing-cta";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { Hero } from "@/components/landing/hero";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteNav } from "@/components/landing/site-nav";
import { JsonLd } from "@/components/seo/json-ld";
import { FONT_CATALOG } from "@/lib/fonts/catalog";
import { FILTER_PRESETS } from "@/lib/image-filters/presets";
import { homeStructuredData } from "@/lib/seo/structured-data";

const DESCRIPTION =
  "A free, open-source Canva alternative for YouTube thumbnails and social posts: every size from Story to 4K, free background removal, filters, fonts, and live collaboration.";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  description: DESCRIPTION,
  title: {
    absolute: "Orcanva · Free design editor for thumbnails and social images",
  },
};

const STRUCTURED_DATA = homeStructuredData({
  description: DESCRIPTION,
  features: [
    "Canvas presets from YouTube thumbnail and Instagram Story to 4K, or any custom size",
    "Background removal in the browser, free and unlimited",
    `${FONT_CATALOG.length} curated Google Fonts with outline, shadow and highlight`,
    `${FILTER_PRESETS.length} photo filters plus adjustments`,
    "Shapes, lines, arrows, gradients and layers",
    "Live collaboration on shared designs",
    "PNG, JPG and WebP export at 1× or 2×, with transparent backgrounds",
    "Free and open source under the MIT licence",
  ],
});

const LandingPage = () => (
  <>
    <SiteNav />
    <main>
      <Hero />
      <FeatureGrid />
      <ClosingCta />
    </main>
    <SiteFooter />
    <JsonLd data={STRUCTURED_DATA} />
  </>
);

export default LandingPage;
