// The EyeDropper API (Chrome, Edge and Opera on desktop). lib.dom doesn't
// have it yet: https://wicg.github.io/eyedropper-api/
interface ColorSelectionOptions {
  signal?: AbortSignal;
}

interface ColorSelectionResult {
  // The picked pixel as #rrggbb
  sRGBHex: string;
}

interface EyeDropper {
  open: (options?: ColorSelectionOptions) => Promise<ColorSelectionResult>;
}

// Missing in browsers without the API
interface Window {
  EyeDropper?: new () => EyeDropper;
}
