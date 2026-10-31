import { RiArrowRightLine, RiPaletteLine } from "@remixicon/react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { STUDIO_PATH } from "@/lib/routes";

const LandingPage = () => (
  <main className="flex min-h-svh flex-col items-center justify-center gap-6 p-6 text-center">
    <div className="flex items-center gap-2">
      <RiPaletteLine aria-hidden />
      <span className="font-heading text-lg font-semibold">Orcanva</span>
    </div>
    <h1 className="font-heading text-5xl font-semibold tracking-tight text-balance">
      Thumbnails worth the click.
    </h1>
    <Button size="lg" render={<Link href={STUDIO_PATH} />}>
      Open Studio
      <RiArrowRightLine data-icon="inline-end" />
    </Button>
  </main>
);

export default LandingPage;
