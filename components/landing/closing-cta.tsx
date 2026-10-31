import { RiArrowRightLine } from "@remixicon/react";

import { Container } from "@/components/landing/container";
import { PillLink } from "@/components/landing/pill-link";
import { STUDIO_PATH } from "@/lib/routes";

export const ClosingCta = () => (
  <section aria-labelledby="closing-heading" className="pb-20 md:pb-30">
    <Container>
      <div className="bg-bone flex flex-col items-center gap-6 rounded-3xl px-6 py-20 text-center md:py-28">
        <h2
          id="closing-heading"
          className="text-heading md:text-heading-lg max-w-2xl font-normal text-balance"
        >
          Your next thumbnail starts here.
        </h2>
        <p className="text-graphite max-w-md text-lg text-pretty">
          Pick a size, drop in a photo, and start typing.
        </p>
        <PillLink href={STUDIO_PATH} size="lg" className="mt-2">
          Open Studio
          <RiArrowRightLine aria-hidden />
        </PillLink>
      </div>
    </Container>
  </section>
);
