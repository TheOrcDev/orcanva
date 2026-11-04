import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { Geist_Mono, Instrument_Sans, Figtree } from "next/font/google";

import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toast";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SITE_NAME, SITE_URL } from "@/lib/site";
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
  applicationName: SITE_NAME,
  description:
    "A free design editor for YouTube thumbnails and social images, right in your browser.",
  // Share images and canonical URLs resolve against production
  metadataBase: new URL(SITE_URL),
  // Pages that set `openGraph` replace this whole object, so none do: the
  // title and description come from each page's own
  openGraph: { locale: "en_US", siteName: SITE_NAME, type: "website" },
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  // X reads the share image from og:image, but needs this to show it large
  twitter: { card: "summary_large_image" },
};

// Vercel Analytics only works on Vercel; elsewhere its script is a 404
const IS_VERCEL = Boolean(process.env.VERCEL);

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
      {IS_VERCEL && <Analytics />}
    </body>
  </html>
);

export default RootLayout;
