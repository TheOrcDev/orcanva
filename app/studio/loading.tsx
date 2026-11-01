import Link from "next/link";

import { LogoMark } from "@/components/logo-mark";
import { Skeleton } from "@/components/ui/skeleton";

const PLACEHOLDER_CARDS = ["first", "second", "third", "fourth"];

// The studio reads the gallery on every request; this shows at once in the
// meantime, so "Open Studio" on the landing responds before the data does
const StudioLoading = () => (
  <div className="flex min-h-svh flex-col">
    <header className="border-b">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-6">
        <Link href="/" className="flex items-center gap-2">
          <LogoMark className="size-5" />
          <span className="font-heading text-lg font-semibold">Orcanva</span>
        </Link>
        <Skeleton className="h-9 w-36" />
      </div>
    </header>
    <main
      aria-busy
      className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-6 py-8"
    >
      <span className="sr-only">Loading designs</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {PLACEHOLDER_CARDS.map((key) => (
          <li key={key} className="flex flex-col gap-3">
            <Skeleton className="aspect-video" />
            <Skeleton className="h-4 w-2/3" />
          </li>
        ))}
      </ul>
    </main>
  </div>
);

export default StudioLoading;
