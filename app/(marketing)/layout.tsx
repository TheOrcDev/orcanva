import { Inter } from "next/font/google";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// Optical sizing tightens Inter at display sizes on its own
const inter = Inter({
  axes: ["opsz"],
  subsets: ["latin"],
  variable: "--font-inter",
});

// Marketing pages sit on a light-only linen canvas, whatever theme the
// studio uses (the ThemeProvider forces light here as well)
const MarketingLayout = ({
  children,
}: Readonly<{
  children: ReactNode;
}>) => (
  <div
    data-landing
    className={cn(
      inter.variable,
      "bg-linen font-landing text-ink min-h-svh scheme-light"
    )}
  >
    {children}
  </div>
);

export default MarketingLayout;
