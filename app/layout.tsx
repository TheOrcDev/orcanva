import type { Metadata } from "next";
import { Geist_Mono, Instrument_Sans, Figtree } from "next/font/google";

import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const figtreeHeading = Figtree({
  subsets: ["latin"],
  variable: "--font-heading",
});

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
});

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  description: "Design thumbnails and social images",
  // Share images and canonical URLs resolve against production
  metadataBase: new URL("https://orcanva.vercel.app"),
  title: { default: "Orcanva", template: "%s · Orcanva" },
};

const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => (
  <html
    lang="en"
    suppressHydrationWarning
    className={cn(
      "antialiased",
      fontMono.variable,
      "font-sans",
      instrumentSans.variable,
      figtreeHeading.variable
    )}
  >
    <body>
      <ThemeProvider>
        <TooltipProvider>
          <Toaster>{children}</Toaster>
        </TooltipProvider>
      </ThemeProvider>
    </body>
  </html>
);

export default RootLayout;
