import { RiArrowRightLine } from "@remixicon/react";

import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SizePreset } from "@/lib/document/presets";
import { newDesignPath } from "@/lib/routes";
import { aspectRatio } from "@/lib/seo/aspect-ratio";
import { cn } from "@/lib/utils";

// The canvases a page makes: the size, its ratio and the formats it
// downloads in, with a link that opens a blank one (plain <a>, since /new
// makes a design and must never be prefetched)
export const SizeCards = ({ presets }: { presets: readonly SizePreset[] }) => (
  <ul className={cn("grid gap-4", presets.length > 1 && "md:grid-cols-2")}>
    {presets.map((preset) => (
      <li key={preset.id} className="flex">
        <Card className="flex-1">
          <CardHeader>
            <CardTitle>
              <h3>{preset.label}</h3>
            </CardTitle>
            {/* Some presets' descriptions just repeat their label */}
            {preset.description === preset.label ? null : (
              <CardDescription>{preset.description}</CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <dl className="grid gap-6 sm:grid-cols-3">
              <div className="flex flex-col-reverse gap-1">
                <dt className="text-muted-foreground text-sm">Pixels</dt>
                <dd className="font-heading text-subheading tabular-nums">
                  {preset.width} × {preset.height}
                </dd>
              </div>
              <div className="flex flex-col-reverse gap-1">
                <dt className="text-muted-foreground text-sm">Ratio</dt>
                <dd className="font-heading text-subheading tabular-nums">
                  {aspectRatio(preset.width, preset.height)}
                </dd>
              </div>
              <div className="flex flex-col-reverse gap-1">
                <dt className="text-muted-foreground text-sm">Download</dt>
                <dd className="font-heading text-subheading">PNG, JPG, WebP</dd>
              </div>
            </dl>
          </CardContent>
          <CardFooter>
            <a
              href={newDesignPath(preset.id)}
              rel="nofollow"
              className={buttonVariants({ variant: "outline" })}
            >
              Open a blank {preset.width}×{preset.height} canvas
              <RiArrowRightLine data-icon="inline-end" />
            </a>
          </CardFooter>
        </Card>
      </li>
    ))}
  </ul>
);
