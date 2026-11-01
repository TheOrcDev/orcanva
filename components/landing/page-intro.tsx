import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";

// The top of a landing page beside `/`: a tag, the headline (the page's one
// h1), the line under it and what to do next
export const PageIntro = ({
  actions,
  children,
  tag,
  title,
}: {
  actions?: ReactNode;
  children: ReactNode;
  tag?: string;
  title: string;
}) => (
  <header className="flex flex-col items-center gap-6 text-center">
    {tag ? <Badge variant="secondary">{tag}</Badge> : null}
    <h1 className="font-heading text-heading-lg md:text-display max-w-4xl font-normal text-balance">
      {title}
    </h1>
    <p className="text-muted-foreground max-w-2xl text-lg text-pretty">
      {children}
    </p>
    {actions ? (
      <div className="flex flex-wrap justify-center gap-2">{actions}</div>
    ) : null}
  </header>
);
