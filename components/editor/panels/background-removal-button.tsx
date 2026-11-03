"use client";

import { RiMagicLine } from "@remixicon/react";

import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import type { ImageElement } from "@/lib/document/schema";
import { hasVariant } from "@/lib/editor/asset-variants";
import { removeImageBackground } from "@/lib/editor/background-removal";
import { stopIfOutdated } from "@/lib/editor/outdated";

export const BackgroundRemovalButton = ({
  element,
}: {
  element: ImageElement;
}) => {
  const store = useEditorStoreApi();
  const asset = useEditor((state) =>
    state.assets.find((item) => item.id === element.assetId)
  );
  // A cutout, or something made from one, has no background left to remove
  const cutOut = useEditor((state) =>
    hasVariant(state.assets, element.assetId, "no-background")
  );
  // Any AI tool at work on this image keeps the others waiting
  const job = useEditor((state) => state.imageJobs[element.id] ?? null);
  const running = job === "background";

  if (cutOut && !running) {
    return null;
  }

  // Like toast.promise, but the loading toast also shows download progress
  const run = async () => {
    const toastId = toast.add({
      description:
        "Runs in your browser. The first time downloads a ~220 MB AI model.",
      title: "Removing background…",
      type: "loading",
    });
    const onProgress = (percent: number) =>
      toast.update(toastId, {
        description:
          percent < 100
            ? `Downloading the AI model… ${Math.floor(percent)}%`
            : "Cutting out the subject…",
      });
    try {
      await removeImageBackground(store, element.id, onProgress);
      toast.update(toastId, {
        description: "Saved to your uploads as a transparent PNG.",
        title: "Background removed",
        type: "success",
      });
    } catch (error) {
      if (stopIfOutdated(store, error)) {
        toast.close(toastId);
        return;
      }
      toast.update(toastId, {
        description: error instanceof Error ? error.message : undefined,
        title: "Couldn't remove the background",
        type: "error",
      });
    }
  };

  return (
    <Button
      className="w-full"
      disabled={job !== null || element.locked || !asset}
      onClick={run}
    >
      {running ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <RiMagicLine data-icon="inline-start" />
      )}
      {running ? "Removing background…" : "Remove background"}
    </Button>
  );
};
