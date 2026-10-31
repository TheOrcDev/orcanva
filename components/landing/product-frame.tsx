import Image from "next/image";

import studioEditor from "@/components/landing/assets/studio-editor.png";
import { Container } from "@/components/landing/container";

// The one product shot: the studio in light mode, editing a thumbnail made
// from the hero's own palette, so the page's colour still comes from the art.
// Phones see a square crop around the canvas, which stays legible.
export const ProductFrame = () => (
  <section aria-label="The studio" className="pb-16 md:pb-20">
    <Container>
      <figure className="flex flex-col gap-4">
        <div className="after:ring-ink/5 relative aspect-square overflow-hidden rounded-3xl bg-white after:absolute after:inset-0 after:rounded-3xl after:ring-1 after:ring-inset sm:aspect-auto">
          <Image
            src={studioEditor}
            alt="The Orcanva studio editing a YouTube thumbnail, with the layers panel on the left and the selected title's text settings on the right"
            placeholder="blur"
            sizes="(min-width: 1200px) 1152px, 100vw"
            className="size-full object-cover sm:h-auto"
          />
        </div>
        <figcaption className="text-ash text-center text-sm">
          The studio: layers on the left, every setting on the right.
        </figcaption>
      </figure>
    </Container>
  </section>
);
