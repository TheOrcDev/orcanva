import type { Metadata } from "next";

import { FeatureGrid } from "@/components/landing/feature-grid";
import { Hero } from "@/components/landing/hero";
import { ProductFrame } from "@/components/landing/product-frame";
import { SiteNav } from "@/components/landing/site-nav";
import { SizesStrip } from "@/components/landing/sizes-strip";
import { Stats } from "@/components/landing/stats";

export const metadata: Metadata = {
  description:
    "A calm editor for YouTube thumbnails and social images: background removal in your browser, curated fonts, filters, and live collaboration.",
  title: { absolute: "Orcanva · Thumbnails worth the click" },
};

const LandingPage = () => (
  <>
    <SiteNav />
    <main>
      <Hero />
      <SizesStrip />
      <ProductFrame />
      <Stats />
      <FeatureGrid />
    </main>
  </>
);

export default LandingPage;
