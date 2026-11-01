import studioEditorDark from "@/components/landing/assets/studio-editor-dark.png";
import studioEditor from "@/components/landing/assets/studio-editor.png";
import { Container } from "@/components/landing/container";
import { ThemedImage } from "@/components/landing/themed-image";

// The one product shot, in the visitor's theme: the studio editing a
// thumbnail made from the hero's own palette, so the page's colour still
// comes from the art. The hero places it just below the painting's sun, so
// the first screen shows the product. Phones see a square crop around the
// canvas, which stays legible.
const ALT =
  "The Orcanva studio editing a YouTube thumbnail, with the layers panel on the left and the selected title's text settings on the right";

export const ProductFrame = ({ className }: { className?: string }) => (
  <Container className={className}>
    <figure className="flex flex-col gap-4">
      <div className="after:ring-foreground/5 bg-card relative aspect-square overflow-hidden rounded-3xl shadow-2xl after:absolute after:inset-0 after:rounded-3xl after:ring-1 after:ring-inset sm:aspect-auto">
        <ThemedImage
          light={studioEditor}
          dark={studioEditorDark}
          alt={ALT}
          sizes="(min-width: 1200px) 1152px, 100vw"
          className="size-full object-cover sm:h-auto"
        />
      </div>
      <figcaption className="text-muted-foreground text-center text-sm">
        The studio: layers on the left, every setting on the right.
      </figcaption>
    </figure>
  </Container>
);
