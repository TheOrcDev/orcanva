import { RiArrowRightLine } from "@remixicon/react";
import Link from "next/link";

import { Container } from "@/components/landing/container";
import { buttonVariants } from "@/components/ui/button";
import { STUDIO_PATH } from "@/lib/routes";

export const ClosingCta = () => (
  <section aria-labelledby="closing-heading" className="pb-20 md:pb-30">
    <Container>
      <div className="bg-muted flex flex-col items-center gap-6 rounded-4xl px-6 py-20 text-center md:py-28">
        <h2
          id="closing-heading"
          className="font-heading text-heading md:text-heading-lg max-w-2xl font-normal text-balance"
        >
          Your next thumbnail starts here.
        </h2>
        <p className="text-muted-foreground max-w-md text-lg text-pretty">
          Pick a size, drop in a photo, and start typing.
        </p>
        <Link
          href={STUDIO_PATH}
          className={buttonVariants({ className: "mt-2", size: "xl" })}
        >
          Open Studio
          <RiArrowRightLine data-icon="inline-end" />
        </Link>
      </div>
    </Container>
  </section>
);
