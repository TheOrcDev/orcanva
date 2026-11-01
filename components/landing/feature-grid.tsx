import {
  RiContrastDrop2Line,
  RiCursorLine,
  RiDownload2Line,
  RiFontSize,
  RiScissorsCutLine,
  RiStackLine,
} from "@remixicon/react";
import type { RemixiconComponentType } from "@remixicon/react";

import { Container } from "@/components/landing/container";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { FONT_CATALOG } from "@/lib/fonts/catalog";
import { FILTER_PRESETS } from "@/lib/image-filters/presets";

interface Feature {
  description: string;
  icon: RemixiconComponentType;
  title: string;
}

const FEATURES: Feature[] = [
  {
    description:
      "One click, run by an open-source model in your browser. No API key, no per-image cost.",
    icon: RiScissorsCutLine,
    title: "Remove background",
  },
  {
    description: `${FILTER_PRESETS.length} looks previewed on your own photo, plus brightness, shadows, warmth, grain, blur and more.`,
    icon: RiContrastDrop2Line,
    title: "Filters and adjustments",
  },
  {
    description: `${FONT_CATALOG.length} curated fonts with outline, drop shadow and highlight, edited right on the canvas.`,
    icon: RiFontSize,
    title: "Type that pops",
  },
  {
    description:
      "Shapes, lines, arrows and gradient backgrounds, ordered in a drag-to-reorder layers panel.",
    icon: RiStackLine,
    title: "Shapes and layers",
  },
  {
    description:
      "Open a design anywhere and see every cursor, selection and edit as it happens.",
    icon: RiCursorLine,
    title: "Live collaboration",
  },
  {
    description: "PNG, JPG or WebP at the size you picked, at 1× or 2×.",
    icon: RiDownload2Line,
    title: "Exact-pixel export",
  },
];

export const FeatureGrid = () => (
  <section
    id="features"
    aria-labelledby="features-heading"
    className="pt-16 pb-20 md:pt-20 md:pb-30"
  >
    <Container className="flex flex-col gap-12">
      <h2
        id="features-heading"
        className="font-heading text-heading md:text-heading-lg max-w-2xl font-normal text-balance"
      >
        Everything a thumbnail needs. Nothing it doesn&apos;t.
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <li key={feature.title} className="flex">
            <Card className="flex-1">
              <CardHeader>
                <feature.icon
                  aria-hidden
                  className="text-muted-foreground mb-2 size-6"
                />
                <CardTitle>
                  <h3>{feature.title}</h3>
                </CardTitle>
                <CardDescription>{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          </li>
        ))}
      </ul>
    </Container>
  </section>
);
