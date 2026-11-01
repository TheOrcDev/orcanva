import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { TOOL_LINKS } from "@/lib/seo/landing-links";

// The other free tools, at the end of each tool page
export const RelatedPages = ({ current }: { current: string }) => (
  <section aria-labelledby="related-heading" className="flex flex-col gap-6">
    <h2
      id="related-heading"
      className="font-heading text-heading font-normal text-balance"
    >
      More free tools
    </h2>
    <ul className="flex flex-wrap gap-2">
      {TOOL_LINKS.filter((link) => link.href !== current).map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            className={buttonVariants({ variant: "outline" })}
          >
            {link.label}
          </Link>
        </li>
      ))}
    </ul>
  </section>
);
