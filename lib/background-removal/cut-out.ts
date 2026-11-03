import { runAiTask } from "@/lib/ai/client";
import type { AiResults } from "@/lib/ai/client";

export type Cutout = AiResults["cutout"];

// Cuts the subject out of an image with BEN2, in the shared AI worker. The
// model loads once per tab and stays warm for later images; `onProgress`
// reports its download.
export const cutOutBackground = (
  image: Blob,
  onProgress?: (percent: number) => void
): Promise<Cutout> =>
  runAiTask({ image, kind: "cutout" }, ({ percent, stage }) => {
    if (stage === "download") {
      onProgress?.(percent);
    }
  });
