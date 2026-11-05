import { RiArrowRightUpLine } from "@remixicon/react";
import type { Metadata } from "next";
import Image from "next/image";

import { Container } from "@/components/landing/container";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteNav } from "@/components/landing/site-nav";
import { LogoMark } from "@/components/logo-mark";
import { buttonVariants } from "@/components/ui/button";
import {
  avatarSrc,
  CONTRIBUTORS_PATH,
  fetchContributors,
  formatContributions,
  totalContributions,
} from "@/lib/contributors";
import type { Contributor } from "@/lib/contributors";
import { GITHUB_URL } from "@/lib/site";

// CONTRIBUTORS_REVALIDATE_SECONDS: an hour, written out because Next reads
// it before the module runs
export const revalidate = 3600;

export const metadata: Metadata = {
  alternates: { canonical: CONTRIBUTORS_PATH },
  description:
    "Meet the people building Orcanva, the free and open-source design studio. See who has contributed and help shape it on GitHub.",
  title: "Contributors",
};

const StatCard = ({ label, value }: { label: string; value: number }) => (
  <div className="bg-card rounded-2xl border p-6 text-center">
    <p className="text-4xl font-semibold tracking-tighter tabular-nums">
      {value.toLocaleString("en-US")}
    </p>
    <p className="text-muted-foreground mt-1 text-sm">{label}</p>
  </div>
);

const ContributorCard = ({ contributor }: { contributor: Contributor }) => (
  <a
    href={contributor.profileUrl}
    target="_blank"
    rel="noopener noreferrer"
    className="group bg-card hover:border-foreground/30 focus-visible:outline-ring flex items-center gap-4 rounded-2xl border p-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2"
  >
    <Image
      src={avatarSrc(contributor.avatarUrl)}
      alt={`${contributor.login}’s avatar`}
      width={48}
      height={48}
      unoptimized
      className="size-12 shrink-0 rounded-full border object-cover"
    />
    <span className="min-w-0 flex-1">
      <span className="block truncate font-medium">{contributor.login}</span>
      <span className="text-muted-foreground mt-0.5 block text-sm tabular-nums">
        {formatContributions(contributor.contributions)}
      </span>
    </span>
    <RiArrowRightUpLine
      aria-hidden="true"
      className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-colors"
    />
  </a>
);

const ContributorsPage = async () => {
  const contributors = await fetchContributors();

  return (
    <>
      <SiteNav />
      <main className="pt-32 pb-20 md:pt-36 md:pb-30">
        <Container className="max-w-4xl">
          <header className="flex flex-col items-center gap-6 pb-14 text-center">
            <LogoMark className="size-16" />
            <h1 className="font-heading text-heading-lg md:text-display font-normal text-balance">
              Our Contributors
            </h1>
            <p className="text-muted-foreground max-w-xl text-lg text-pretty">
              Meet the people who make Orcanva possible. Their contributions,
              big and small, shape the free and open-source design studio.
            </p>
          </header>
          <div className="grid gap-3 pb-10 sm:grid-cols-2">
            <StatCard label="Contributors" value={contributors.length} />
            <StatCard
              label="Total contributions"
              value={totalContributions(contributors)}
            />
          </div>
          {contributors.length > 0 ? (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {contributors.map((contributor) => (
                <li key={contributor.login}>
                  <ContributorCard contributor={contributor} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="bg-card text-muted-foreground rounded-2xl border p-8 text-center">
              Contributor data is unavailable right now. Check back soon, or see
              the project on GitHub.
            </p>
          )}
          <section
            aria-labelledby="contribute-heading"
            className="bg-card mt-16 flex flex-col items-center gap-3 rounded-2xl border p-8 text-center"
          >
            <h2
              id="contribute-heading"
              className="font-heading text-subheading font-normal"
            >
              Want to contribute?
            </h2>
            <p className="text-muted-foreground max-w-md text-sm text-pretty">
              We welcome contributions from developers of every skill level.
              Join in and help make Orcanva even better.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ size: "lg" })}
              >
                View on GitHub
              </a>
              <a
                href={`${GITHUB_URL}/issues`}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants({ size: "lg", variant: "outline" })}
              >
                Open an issue or PR
              </a>
            </div>
          </section>
          <p className="text-muted-foreground pt-10 text-center text-sm">
            Counted from the Orcanva repository on GitHub and refreshed every
            hour.
          </p>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
};

export default ContributorsPage;
