import { RiArrowRightLine, RiPaletteLine } from "@remixicon/react";

import { Container } from "@/components/landing/container";
import { PillLink } from "@/components/landing/pill-link";
import { STUDIO_PATH } from "@/lib/routes";

const LandingPage = () => (
  <main>
    <Container className="flex min-h-svh flex-col items-center justify-center gap-8 text-center">
      <div className="flex items-center gap-2">
        <RiPaletteLine aria-hidden className="size-5" />
        <span className="text-lg font-medium">Orcanva</span>
      </div>
      <h1 className="text-heading-lg md:text-display lg:text-display-lg font-normal text-balance">
        Thumbnails worth the click.
      </h1>
      <PillLink href={STUDIO_PATH} size="lg">
        Open Studio
        <RiArrowRightLine aria-hidden />
      </PillLink>
    </Container>
  </main>
);

export default LandingPage;
