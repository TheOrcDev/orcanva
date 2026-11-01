import { Inter } from "next/font/google";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// Optical sizing tightens Inter at display sizes on its own
const inter = Inter({
  axes: ["opsz"],
  subsets: ["latin"],
  variable: "--font-inter",
});

// Marketing pages use the landing's own paper and ink tokens, which follow
// the same light or dark theme as the studio
const MarketingLayout = ({
  children,
}: Readonly<{
  children: ReactNode;
}>) => (
  <div
    data-landing
    className={cn(inter.variable, "bg-paper font-landing text-ink min-h-svh")}
  >
    {children}
  </div>
);

export default MarketingLayout;
