import { GRID_CLASS_NAME } from "@/components/gallery/design-grid";
import { PageBody, PageHeader } from "@/components/studio/page-header";
import { Skeleton } from "@/components/ui/skeleton";

const PLACEHOLDER_CARDS = ["first", "second", "third", "fourth"];

// The galleries read their designs on every request; this shows at once in
// the meantime, inside the sidebar, so "Open Studio" on the landing and the
// sidebar's links respond before the data does
export const GallerySkeleton = ({ title }: { title: string }) => (
  <>
    <PageHeader title={title} />
    <PageBody aria-busy>
      <span className="sr-only">Loading designs</span>
      <Skeleton className="h-5 w-80 max-w-full" />
      <ul className={GRID_CLASS_NAME}>
        {PLACEHOLDER_CARDS.map((key) => (
          <li key={key} className="flex flex-col gap-3">
            <Skeleton className="aspect-video" />
            <Skeleton className="h-4 w-2/3" />
          </li>
        ))}
      </ul>
    </PageBody>
  </>
);
