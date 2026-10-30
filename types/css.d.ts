import "react";

// Lets components pass CSS custom properties (the only inline style the
// shadcn lint allows) without casts, e.g. style={{ "--swatch": color }}
declare module "react" {
  interface CSSProperties {
    // Must stay an index signature: module augmentation merges interfaces,
    // and a Record type alias would not
    // oxlint-disable-next-line typescript/consistent-indexed-object-style
    [key: `--${string}`]: string | number | undefined;
  }
}
