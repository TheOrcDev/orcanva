import { Roboto } from "next/font/google";

// The mock's type (Apache-2.0), self-hosted by next/font. Not preloaded: the
// mock only shows once someone opens a preview.
export const roboto = Roboto({
  preload: false,
  subsets: ["latin"],
});
