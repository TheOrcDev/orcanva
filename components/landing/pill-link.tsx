import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import Link from "next/link";
import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// The landing's pill-shaped calls to action. Landing colours only, so a
// theme switch mid-navigation never repaints them.
const pillLinkVariants = cva(
  "outline-espresso inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 [&_svg]:shrink-0",
  {
    defaultVariants: {
      size: "default",
      variant: "solid",
    },
    variants: {
      size: {
        default: "h-10 rounded-full px-5 text-sm [&_svg]:size-4",
        lg: "h-14 rounded-full px-7 text-base [&_svg]:size-5",
      },
      variant: {
        ghost: "border-pebble text-ink border hover:bg-white",
        solid: "bg-espresso hover:bg-espresso/85 text-white",
      },
    },
  }
);

export const PillLink = ({
  className,
  size,
  variant,
  ...props
}: ComponentProps<typeof Link> & VariantProps<typeof pillLinkVariants>) => (
  <Link
    className={cn(pillLinkVariants({ size, variant }), className)}
    {...props}
  />
);
