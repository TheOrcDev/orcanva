import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface CardListItem {
  body: string;
  title: string;
}

// A titled section of short cards: numbered steps when `ordered`, otherwise
// points in no particular order
export const CardList = ({
  heading,
  id,
  items,
  ordered = false,
}: {
  heading: string;
  id: string;
  items: readonly CardListItem[];
  ordered?: boolean;
}) => {
  const List = ordered ? "ol" : "ul";
  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-10">
      <h2
        id={`${id}-heading`}
        className="font-heading text-heading md:text-heading-lg max-w-2xl font-normal text-balance"
      >
        {heading}
      </h2>
      <List
        className={cn(
          "grid gap-4 sm:grid-cols-2",
          items.length % 3 === 0 && "lg:grid-cols-3"
        )}
      >
        {items.map((item, index) => (
          <li key={item.title} className="flex">
            <Card className="flex-1">
              <CardHeader>
                {ordered ? (
                  <span
                    aria-hidden
                    className="font-heading text-heading text-muted-foreground mb-2 tabular-nums"
                  >
                    {index + 1}
                  </span>
                ) : null}
                <CardTitle>
                  <h3>{item.title}</h3>
                </CardTitle>
                <CardDescription>{item.body}</CardDescription>
              </CardHeader>
            </Card>
          </li>
        ))}
      </List>
    </section>
  );
};
