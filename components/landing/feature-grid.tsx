import { RiCheckLine } from "@remixicon/react";
import Image from "next/image";
import type { StaticImageData } from "next/image";

import exportShotDark from "@/components/landing/assets/bento/export-dark.webp";
import exportShot from "@/components/landing/assets/bento/export.webp";
import layersShotDark from "@/components/landing/assets/bento/layers-dark.webp";
import layersShot from "@/components/landing/assets/bento/layers.webp";
import lookBone from "@/components/landing/assets/bento/look-bone.webp";
import lookEmber from "@/components/landing/assets/bento/look-ember.webp";
import lookMist from "@/components/landing/assets/bento/look-mist.webp";
import lookOriginal from "@/components/landing/assets/bento/look-original.webp";
import lookSwamp from "@/components/landing/assets/bento/look-swamp.webp";
import orcPainterCutout from "@/components/landing/assets/bento/orc-painter-cutout.webp";
import orcPainter from "@/components/landing/assets/bento/orc-painter.webp";
import thumbnailHacks from "@/components/landing/assets/bento/thumbnail-hacks.webp";
import thumbnailLake from "@/components/landing/assets/bento/thumbnail-lake.webp";
import thumbnailSunset from "@/components/landing/assets/bento/thumbnail-sunset.webp";
import { BentoCard } from "@/components/landing/bento-card";
import { Container } from "@/components/landing/container";
import { MagicBento } from "@/components/landing/magic-bento";
import { ThemedImage } from "@/components/landing/themed-image";
import { Badge } from "@/components/ui/badge";
import { FONT_CATALOG } from "@/lib/fonts/catalog";
import { FILTER_PRESETS, findPreset } from "@/lib/image-filters/presets";
import { REMOVE_AI_METADATA_PATH } from "@/lib/routes";
import { cn } from "@/lib/utils";

// Every picture here is the studio's own output, made from one watercolor of
// an orc painter: the real background removal, thumbnails exported with
// Download, the real filter looks, and the panels themselves in both themes

const RemoveBackground = () => (
  <>
    <Image
      src={orcPainter}
      alt="A watercolor of an orc painter by a lake at sunset"
      fill
      placeholder="blur"
      sizes="(min-width: 1024px) 600px, 100vw"
      className="object-cover"
    />
    <Badge variant="secondary" className="absolute top-4 left-4">
      Before
    </Badge>
    <div className="bento-wipe bento-checker absolute inset-0">
      <Image
        src={orcPainterCutout}
        alt="The same orc after Remove background, with the lake gone"
        fill
        sizes="(min-width: 1024px) 600px, 100vw"
        className="object-cover"
      />
    </div>
    <Badge variant="secondary" className="absolute top-4 right-4">
      After
    </Badge>
    <span
      aria-hidden
      className="bento-wipe-line bg-card absolute inset-y-0 w-0.5 -translate-x-1/2"
    />
  </>
);

const FAN_SIZES = "(min-width: 768px) 400px, 80vw";

// Three takes on one thumbnail, fanned out a little more on hover
const ThumbnailFan = () => (
  <div className="absolute inset-0 flex items-center justify-center">
    <Image
      src={thumbnailHacks}
      alt="Orc art hacks, in yellow Bangers with a drop shadow"
      sizes={FAN_SIZES}
      className="-mr-16 h-3/5 w-auto -rotate-6 rounded-lg shadow-lg transition-transform duration-500 group-hover:-translate-x-4 group-hover:-rotate-8"
    />
    <Image
      src={thumbnailSunset}
      alt="Paint a sunset, in Anton with a thick outline, beside a highlighted tag"
      sizes={FAN_SIZES}
      className="ring-foreground/10 relative z-10 h-4/5 w-auto rounded-xl shadow-xl ring-1"
    />
    <Image
      src={thumbnailLake}
      alt="My first lake, in Luckiest Guy with a hard shadow"
      sizes={FAN_SIZES}
      className="-ml-16 h-3/5 w-auto rotate-6 rounded-lg shadow-lg transition-transform duration-500 group-hover:translate-x-4 group-hover:rotate-8"
    />
  </div>
);

// A panel from the studio, framed like a window and fading into the tile.
// Wide screens show it at its real size, running off the tile's edge.
const PanelShot = ({
  alt,
  className,
  dark,
  light,
}: {
  alt: string;
  className: string;
  dark: StaticImageData;
  light: StaticImageData;
}) => (
  <>
    <div
      className={cn(
        "ring-foreground/10 absolute inset-x-6 top-6 overflow-hidden rounded-xl shadow-sm ring-1 lg:right-auto",
        className
      )}
    >
      <ThemedImage
        light={light}
        dark={dark}
        alt={alt}
        sizes="(min-width: 768px) 320px, 90vw"
        className="h-auto w-full"
      />
    </div>
    <div className="from-card absolute inset-x-0 bottom-0 h-8 bg-linear-to-t to-transparent" />
  </>
);

interface Look {
  id: string;
  image: StaticImageData;
}

const LOOKS: Look[] = [
  { id: "ember", image: lookEmber },
  { id: "mist", image: lookMist },
  { id: "swamp", image: lookSwamp },
  { id: "bone", image: lookBone },
];

// The look strip as the studio shows it, Ember picked
const LookStrip = () => (
  <ul className="grid h-full grid-cols-5 content-center gap-3 p-6">
    {[{ id: "original", image: lookOriginal }, ...LOOKS].map((look) => (
      <li key={look.id} className="flex flex-col items-center gap-2">
        <Image
          src={look.image}
          alt=""
          sizes="96px"
          className={
            look.id === "ember"
              ? "ring-primary ring-offset-card aspect-square w-full rounded-xl object-cover ring-2 ring-offset-2"
              : "aspect-square w-full rounded-xl object-cover"
          }
        />
        <span className="text-muted-foreground text-xs">
          {findPreset(look.id)?.name ?? "Original"}
        </span>
      </li>
    ))}
  </ul>
);

// The metadata remover's result as /remove-ai-metadata shows it
const REMOVED = [
  "Content Credentials (C2PA)",
  "“AI generated” tag",
  "Prompt and settings",
  "GPS location",
];

const CleanImage = () => (
  <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 sm:flex-row sm:gap-5">
    <Image
      src={lookOriginal}
      alt="The orc painter's portrait, without its metadata"
      sizes="160px"
      className="ring-foreground/10 aspect-square h-24 w-auto shrink-0 rounded-xl object-cover shadow-sm ring-1 sm:h-full sm:max-h-40"
    />
    <div className="flex flex-col items-center gap-2 sm:items-start">
      <p className="text-muted-foreground text-xs">Removed from your image</p>
      <ul className="flex flex-wrap justify-center gap-1.5 sm:flex-col sm:items-start">
        {REMOVED.map((label) => (
          <li key={label}>
            <Badge variant="secondary">
              <RiCheckLine data-icon="inline-start" />
              {label}
            </Badge>
          </li>
        ))}
      </ul>
    </div>
  </div>
);

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
      <MagicBento className="grid gap-4 md:grid-cols-2 lg:grid-flow-row-dense lg:grid-cols-4">
        <BentoCard
          title="Remove background"
          description="One click, run by an open-source model in your browser. No API key, no per-image cost."
          visual={<RemoveBackground />}
          visualClassName="min-h-80"
          className="md:col-span-2 md:row-span-2"
        />
        <BentoCard
          title="Type that pops"
          description={`${FONT_CATALOG.length} curated fonts with outline, drop shadow and highlight, edited right on the canvas.`}
          visual={<ThumbnailFan />}
          className="md:col-span-2"
        />
        <BentoCard
          title="Shapes and layers"
          description="Shapes, arrows and gradients, stacked in a drag-to-reorder layers panel."
          visual={
            <PanelShot
              light={layersShot}
              dark={layersShotDark}
              className="lg:w-72"
              alt="The layers panel listing Arrow, Tag, Title, Orc and Sun, with Title selected"
            />
          }
        />
        <BentoCard
          title="Exact-pixel export"
          description="PNG, JPG or WebP at the size you picked, at 1× or 2×."
          visual={
            <PanelShot
              light={exportShot}
              dark={exportShotDark}
              className="lg:w-80"
              alt="Download settings: PNG, JPG or WebP, at 1× (1280 × 720) or 2× (2560 × 1440)"
            />
          }
        />
        <BentoCard
          title="Filters and adjustments"
          description={`${FILTER_PRESETS.length} looks previewed on your own photo, plus brightness, shadows, warmth, grain, blur and more.`}
          visual={<LookStrip />}
          visualClassName="min-h-0"
          className="md:col-span-2"
        />
        <BentoCard
          href={REMOVE_AI_METADATA_PATH}
          title="Remove AI metadata"
          description="Drop in any image and download it without the Content Credentials and “AI generated” tag that Instagram and TikTok read to label it. Free, lossless, and nothing is uploaded."
          visual={<CleanImage />}
          visualClassName="min-h-72"
          className="md:col-span-2"
        />
      </MagicBento>
    </Container>
  </section>
);
