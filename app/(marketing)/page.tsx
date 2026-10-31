import type { Metadata } from "next";

import { Hero } from "@/components/landing/hero";
import { SiteNav } from "@/components/landing/site-nav";
import { SizesStrip } from "@/components/landing/sizes-strip";

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
    </main>
  </>
);

export default LandingPage;
