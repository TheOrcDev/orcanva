import Link from "next/link";

import { Container } from "@/components/landing/container";
import { Logo } from "@/components/landing/logo";
import { signInUrl, signUpUrl } from "@/lib/auth/redirect";
import { STUDIO_PATH } from "@/lib/routes";
import { COMPARE_LINKS, TOOL_LINKS } from "@/lib/seo/landing-links";
import type { LandingLink } from "@/lib/seo/landing-links";
import { SPONSORS_PATH } from "@/lib/sponsors";

// Every landing page links to every other one from here, which is also how
// search engines find them all
const COLUMNS: { heading: string; links: readonly LandingLink[] }[] = [
  {
    heading: "Orcanva",
    links: [
      { href: STUDIO_PATH, label: "Studio" },
      { href: SPONSORS_PATH, label: "Sponsors" },
      { href: signInUrl(STUDIO_PATH), label: "Sign in" },
      { href: signUpUrl(STUDIO_PATH), label: "Create account" },
    ],
  },
  { heading: "Free tools", links: TOOL_LINKS },
  { heading: "Compare", links: COMPARE_LINKS },
];

// No year: the page is built once, so it would go stale
export const SiteFooter = () => (
  <footer className="border-t">
    <Container className="grid gap-10 py-12 md:grid-cols-[2fr_1fr_1fr_1fr]">
      <div className="flex flex-col gap-2">
        <Link
          href="/"
          aria-label="Orcanva home"
          className="focus-visible:outline-ring self-start rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <Logo />
        </Link>
        <p className="text-muted-foreground text-sm">
          From idea to design in minutes.
        </p>
      </div>
      {COLUMNS.map((column) => (
        <nav key={column.heading} aria-label={column.heading}>
          <h2 className="mb-3 text-sm font-medium">{column.heading}</h2>
          <ul className="text-muted-foreground flex flex-col gap-2 text-sm">
            {column.links.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="hover:text-foreground focus-visible:outline-ring rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ))}
    </Container>
  </footer>
);
