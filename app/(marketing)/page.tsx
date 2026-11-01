import type { Metadata } from "next";

import { ClosingCta } from "@/components/landing/closing-cta";
import { Collaboration } from "@/components/landing/collaboration";
import { FeatureGrid } from "@/components/landing/feature-grid";
import { Hero } from "@/components/landing/hero";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteNav } from "@/components/landing/site-nav";
import { SizesStrip } from "@/components/landing/sizes-strip";
import { Stats } from "@/components/landing/stats";

export const metadata: Metadata = {
  description:
    "From idea to design in minutes: every size from Story to 4K, background removal in your browser, curated fonts, filters, and live collaboration.",
  title: { absolute: "Orcanva · From idea to design in minutes" },
  // X reads the share image from og:image, but needs this to show it large
  twitter: { card: "summary_large_image" },
};

const LandingPage = () => (
  <>
    <SiteNav />
    <main>
      <Hero />
      <SizesStrip />
      <Stats />
      <FeatureGrid />
      <Collaboration />
      <ClosingCta />
    </main>
    <SiteFooter />
  </>
);

export default LandingPage;
