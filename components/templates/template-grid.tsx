import Image from "next/image";

import { newDesignPath } from "@/lib/routes";
import type { TemplateSummary } from "@/lib/templates/schema";
import { cn } from "@/lib/utils";

// Wide banners two to a row, landscape three, squares and portraits four
const columnsFor = ({ height, width }: TemplateSummary) => {
  const ratio = width / height;
  if (ratio > 2.5) {
    return "md:grid-cols-2";
  }
  return ratio >= 1
    ? "sm:grid-cols-2 lg:grid-cols-3"
    : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4";
};

const sizesFor = ({ height, width }: TemplateSummary) =>
  width >= height
    ? "(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
    : "(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw";

// Templates as previews that each open a new design made from them, after
// sign-up for guests. Plain <a>s: /new makes a design, so it must never be
// prefetched, and robots.txt keeps crawlers out of it.
export const TemplateGrid = ({
  templates,
}: {
  templates: readonly TemplateSummary[];
}) => {
  const [first] = templates;
  if (!first) {
    return null;
  }
  return (
    <ul className={cn("grid gap-x-4 gap-y-6", columnsFor(first))}>
      {templates.map((template) => (
        <li key={template.id}>
          <a
            href={newDesignPath(template.presetId, template.id)}
            rel="nofollow"
            className="group focus-visible:ring-ring/50 flex flex-col gap-2 rounded-2xl outline-none focus-visible:ring-3"
          >
            <span
              className="bg-muted ring-foreground/10 group-hover:ring-primary relative block aspect-(--template-aspect) overflow-hidden rounded-2xl ring-1 transition-shadow group-hover:ring-2"
              style={{
                "--template-aspect": `${template.width} / ${template.height}`,
              }}
            >
              <Image
                src={template.preview}
                alt=""
                fill
                unoptimized
                sizes={sizesFor(template)}
                className="object-cover"
              />
            </span>
            <span className="flex flex-col">
              <span className="font-medium">{template.name}</span>
              <span className="text-muted-foreground text-sm">
                {template.category}
              </span>
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
};
