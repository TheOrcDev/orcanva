import Image from "next/image";

import studioEditorDark from "@/components/landing/assets/studio-editor-dark.png";
import studioEditor from "@/components/landing/assets/studio-editor.png";
import { Container } from "@/components/landing/container";

// The one product shot, in the visitor's theme: the studio editing a
// thumbnail made from the hero's own palette, so the page's colour still
// comes from the art. Both shots load lazily, so only the visible one is
// fetched. Phones see a square crop around the canvas, which stays legible.
const ALT =
  "The Orcanva studio editing a YouTube thumbnail, with the layers panel on the left and the selected title's text settings on the right";

export const ProductFrame = () => (
  <section aria-label="The studio" className="pb-16 md:pb-20">
    <Container>
      <figure className="flex flex-col gap-4">
        <div className="after:ring-ink/5 bg-surface relative aspect-square overflow-hidden rounded-3xl after:absolute after:inset-0 after:rounded-3xl after:ring-1 after:ring-inset sm:aspect-auto">
          <Image
            src={studioEditor}
            alt={ALT}
            placeholder="blur"
            sizes="(min-width: 1200px) 1152px, 100vw"
            className="size-full object-cover sm:h-auto dark:hidden"
          />
          <Image
            src={studioEditorDark}
            alt={ALT}
            placeholder="blur"
            sizes="(min-width: 1200px) 1152px, 100vw"
            className="hidden size-full object-cover sm:h-auto dark:block"
          />
        </div>
        <figcaption className="text-ink-muted text-center text-sm">
          The studio: layers on the left, every setting on the right.
        </figcaption>
      </figure>
    </Container>
  </section>
);
