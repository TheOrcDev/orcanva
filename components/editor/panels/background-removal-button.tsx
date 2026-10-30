"use client";

import { RiArrowGoBackLine, RiMagicLine } from "@remixicon/react";

import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import type { ImageElement } from "@/lib/document/schema";
import { removeImageBackground } from "@/lib/editor/background-removal";
import { updateElement } from "@/lib/editor/document-ops";

export const BackgroundRemovalButton = ({
  element,
}: {
  element: ImageElement;
}) => {
  const store = useEditorStoreApi();
  const asset = useEditor((state) =>
    state.assets.find((item) => item.id === element.assetId)
  );
  const running = useEditor((state) =>
    state.backgroundJobs.includes(element.id)
  );
  const sourceAssetId = asset?.sourceAssetId ?? null;

  if (sourceAssetId) {
    return (
      <Button
        variant="outline"
        className="w-full"
        disabled={element.locked}
        onClick={() =>
          store
            .getState()
            .change((doc) =>
              updateElement(doc, element.id, { assetId: sourceAssetId })
            )
        }
      >
        <RiArrowGoBackLine data-icon="inline-start" />
        Restore original
      </Button>
    );
  }

  const run = () => {
    toast
      .promise(removeImageBackground(store, element.id), {
        error: (error: unknown) => ({
          description: error instanceof Error ? error.message : undefined,
          title: "Couldn't remove the background",
        }),
        loading: {
          description:
            "Runs on this machine. The first time downloads a ~220 MB AI model.",
          title: "Removing background…",
        },
        success: {
          description: "Saved to your uploads as a transparent PNG.",
          title: "Background removed",
        },
      })
      .catch(() => null);
  };

  return (
    <Button
      className="w-full"
      disabled={running || element.locked || !asset}
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
