import { CollabMock } from "@/components/landing/collab-mock";
import { Container } from "@/components/landing/container";

export const Collaboration = () => (
  <section
    id="collaboration"
    aria-labelledby="collaboration-heading"
    className="pb-20 md:pb-30"
  >
    <Container className="grid items-center gap-12 lg:grid-cols-2">
      <div className="flex flex-col gap-6">
        <h2
          id="collaboration-heading"
          className="font-heading text-heading md:text-heading-lg font-normal text-balance"
        >
          Design together, live.
        </h2>
        <p className="text-muted-foreground text-body-lg max-w-md text-pretty">
          Make a design public and anyone with the link can edit it with you,
          signed in or not. Yours stay private until you say otherwise. Found
          one you like? Use it as a template.
        </p>
      </div>
      <CollabMock />
      <p className="sr-only">
        Two people editing the same thumbnail: Mila has the title selected while
        Jonas points at the photo.
      </p>
    </Container>
  </section>
);
