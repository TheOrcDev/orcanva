import Link from "next/link";

import { Container } from "@/components/landing/container";
import { Logo } from "@/components/landing/logo";
import { buttonVariants } from "@/components/ui/button";
import { signInUrl } from "@/lib/auth/redirect";
import { STUDIO_PATH } from "@/lib/routes";

const SECTIONS = [
  { href: "#features", label: "Features" },
  { href: "#collaboration", label: "Collaboration" },
];

// The same for everyone, so the page stays static: signing in from here
// lands in the studio, and someone already signed in is sent straight on
export const SiteNav = () => (
  <header className="absolute inset-x-0 top-0 z-10">
    <Container className="flex h-18 items-center justify-between gap-6 md:grid md:grid-cols-3">
      <Link
        href="/"
        aria-label="Orcanva home"
        className="focus-visible:outline-ring justify-self-start rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <Logo />
      </Link>
      <nav
        aria-label="Main"
        className="text-muted-foreground hidden items-center gap-8 justify-self-center text-sm md:flex"
      >
        {SECTIONS.map((section) => (
          <a
            key={section.href}
            href={section.href}
            className="hover:text-foreground focus-visible:outline-ring rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {section.label}
          </a>
        ))}
      </nav>
      <div className="flex items-center gap-2 justify-self-end">
        <Link
          href={signInUrl(STUDIO_PATH)}
          className={buttonVariants({
            className: "hidden sm:inline-flex",
            size: "lg",
            variant: "outline",
          })}
        >
          Sign in
        </Link>
        <Link href={STUDIO_PATH} className={buttonVariants({ size: "lg" })}>
          Open Studio
        </Link>
      </div>
    </Container>
  </header>
);
