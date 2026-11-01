import type { Metadata } from "next";
import Link from "next/link";

import { LogoMark } from "@/components/logo-mark";
import { buttonVariants } from "@/components/ui/button";
import { STUDIO_PATH } from "@/lib/routes";

export const metadata: Metadata = { title: "Page not found" };

// Every 404: a mistyped address, and a private design opened by someone else
// (which answers 404 rather than reveal that it exists)
const NotFound = () => (
  <main className="flex min-h-svh flex-col items-center justify-center gap-8 p-6 text-center">
    <Link href="/" className="flex items-center gap-2">
      <LogoMark className="size-5" />
      <span className="font-heading text-lg font-semibold">Orcanva</span>
    </Link>
    <div className="flex max-w-md flex-col gap-3">
      <h1 className="font-heading text-heading font-normal">Page not found</h1>
      <p className="text-muted-foreground text-pretty">
        This page doesn&apos;t exist, or it&apos;s a private design you
        can&apos;t open.
      </p>
    </div>
    <div className="flex flex-wrap justify-center gap-2">
      <Link href="/" className={buttonVariants({ variant: "outline" })}>
        Home
      </Link>
      <Link href={STUDIO_PATH} className={buttonVariants()}>
        Open Studio
      </Link>
    </div>
  </main>
);

export default NotFound;
