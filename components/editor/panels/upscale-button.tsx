"use client";

import { RiHdLine } from "@remixicon/react";

import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import type { AiProgress } from "@/lib/ai/client";
import type { PhotoElement } from "@/lib/document/schema";
import { stopIfOutdated } from "@/lib/editor/outdated";
import { upscaleImage } from "@/lib/editor/upscale";
import { factorLabel, looksSoft, upscaleOptions } from "@/lib/upscale/options";
import type { UpscaleOption } from "@/lib/upscale/options";

const sizeLabel = ({ height, width }: UpscaleOption) => `${width} × ${height}`;

// 2× and 4× (capped at 4096px), each labelled with the size it makes, and a
// hint when the photo has fewer pixels than its size on the page needs
export const UpscaleButtons = ({
  assetId,
  element,
}: {
  assetId: string;
  element: PhotoElement;
}) => {
  const store = useEditorStoreApi();
  const asset = useEditor((state) =>
    state.assets.find((item) => item.id === assetId)
  );
  const job = useEditor((state) => state.imageJobs[element.id] ?? null);

  if (!asset) {
    return null;
  }
  const options = upscaleOptions(asset);
  if (options.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        Upscaling stops at 4096px, and this photo is close to that already.
      </p>
    );
  }

  const run = async (option: UpscaleOption) => {
    const toastId = toast.add({
      description: `To ${sizeLabel(option)}, in your browser.`,
      title: `Upscaling ${factorLabel(option.factor)}…`,
      type: "loading",
    });
    const onProgress = ({ percent, stage }: AiProgress) =>
      toast.update(toastId, {
        description:
          stage === "download" && percent < 100
            ? `Downloading the AI model… ${Math.floor(percent)}%`
            : `Sharpening… ${Math.floor(stage === "work" ? percent : 0)}%`,
      });
    try {
      await upscaleImage(store, element.id, option, onProgress);
      toast.update(toastId, {
        description: `Saved to your uploads at ${sizeLabel(option)}.`,
        title: "Upscaled",
        type: "success",
      });
    } catch (error) {
      if (stopIfOutdated(store, error)) {
        toast.close(toastId);
        return;
      }
      toast.update(toastId, {
        description: error instanceof Error ? error.message : undefined,
        title: "Couldn't upscale the image",
        type: "error",
      });
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-2">
        {options.map((option) => (
          <Button
            key={option.variant}
            variant="outline"
            size="sm"
            disabled={job !== null || element.locked}
            aria-label={`Upscale ${factorLabel(option.factor)}, to ${option.width} by ${option.height} pixels`}
            onClick={() => run(option)}
          >
            {job === "upscale" ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <RiHdLine data-icon="inline-start" />
            )}
            {factorLabel(option.factor)}
            <span className="text-muted-foreground text-xs tabular-nums">
              {sizeLabel(option)}
            </span>
          </Button>
        ))}
      </div>
      {looksSoft(asset, element, element.crop) ? (
        <p className="text-muted-foreground text-xs">
          This photo has fewer pixels than its size here needs, so it can look
          soft. Upscaling sharpens it.
        </p>
      ) : null}
    </div>
  );
};
