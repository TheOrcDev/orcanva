import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

// The landing's 1200px column
export const Container = ({ className, ...props }: ComponentProps<"div">) => (
  <div className={cn("mx-auto w-full max-w-300 px-6", className)} {...props} />
);
