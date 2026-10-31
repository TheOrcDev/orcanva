import Link from "next/link";

import { Container } from "@/components/landing/container";
import { Logo } from "@/components/landing/logo";
import { signInUrl } from "@/lib/auth/redirect";
import { STUDIO_PATH } from "@/lib/routes";

const LINKS = [
  { href: STUDIO_PATH, label: "Studio" },
  { href: signInUrl(STUDIO_PATH), label: "Sign in" },
  { href: "/auth/sign-up", label: "Create account" },
];

// No year: the page is built once, so it would go stale
export const SiteFooter = () => (
  <footer className="border-pebble/40 border-t">
    <Container className="flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-col gap-2">
        <Link
          href="/"
          aria-label="Orcanva home"
          className="outline-espresso self-start rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <Logo />
        </Link>
        <p className="text-ash text-sm">Thumbnails worth the click.</p>
      </div>
      <nav aria-label="Footer">
        <ul className="text-graphite flex flex-wrap gap-x-6 gap-y-2 text-sm">
          {LINKS.map((link) => (
            <li key={link.label}>
              <Link
                href={link.href}
                className="hover:text-ink outline-espresso rounded-sm transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </Container>
  </footer>
);
