import Link from "next/link";

import { Container } from "@/components/landing/container";
import { Logo } from "@/components/landing/logo";
import { PillLink } from "@/components/landing/pill-link";
import { signInUrl } from "@/lib/auth/redirect";
import { STUDIO_PATH } from "@/lib/routes";

// The same for everyone, so the page stays static: signing in from here
// lands in the studio, and someone already signed in is sent straight on
export const SiteNav = () => (
  <header className="absolute inset-x-0 top-0 z-10">
    <Container className="flex h-18 items-center justify-between gap-6">
      <Link href="/" aria-label="Orcanva home">
        <Logo />
      </Link>
      <div className="flex items-center gap-2">
        <PillLink
          href={signInUrl(STUDIO_PATH)}
          variant="ghost"
          className="hidden sm:inline-flex"
        >
          Sign in
        </PillLink>
        <PillLink href={STUDIO_PATH}>Open Studio</PillLink>
      </div>
    </Container>
  </header>
);
