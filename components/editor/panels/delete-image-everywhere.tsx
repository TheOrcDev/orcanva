"use client";

import { RiDeleteBinLine } from "@remixicon/react";
import { useState, useTransition } from "react";

import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { PanelSection } from "@/components/editor/panels/panel-section";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { deleteImageEverywhere } from "@/lib/actions/assets";
import { canDeleteImageEverywhere } from "@/lib/auth/access";
import { removePhotos } from "@/lib/editor/frames";
import { stopIfOutdated } from "@/lib/editor/outdated";

// An admin's way to take down a photo someone put on a public design: its
// file and every copy made from it or that it was made from go for good.
// Then it comes off this design's pages like any edit, which saves it and
// takes it off everyone else's screens.
export const DeleteImageEverywhere = ({ assetId }: { assetId: string }) => {
  const store = useEditorStoreApi();
  const allowed = useEditor((state) =>
    canDeleteImageEverywhere(state.visibility, state.viewer?.isAdmin === true)
  );
  const designId = useEditor((state) => state.designId);
  const name = useEditor(
    (state) => state.assets.find((asset) => asset.id === assetId)?.name
  );
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!allowed) {
    return null;
  }

  const handleDelete = () => {
    startTransition(async () => {
      try {
        const ids = await deleteImageEverywhere({ assetId, designId });
        store.getState().changeAllPages((doc) => removePhotos(doc, ids));
        store.getState().markAssetsMissing(ids);
        setOpen(false);
        toast.add({ title: "Image deleted for everyone", type: "success" });
      } catch (error) {
        if (!stopIfOutdated(store, error)) {
          toast.add({
            description: "Check your connection and try again.",
            title: "Could not delete the image",
            type: "error",
          });
        }
      }
    });
  };

  return (
    <PanelSection title="Admin">
      <Button
        variant="destructive"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        <RiDeleteBinLine data-icon="inline-start" />
        Delete image for everyone
      </Button>

      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {name ? `“${name}”` : "this image"} for everyone?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Its file is deleted for good, with every cutout, erase and upscale
              made from it, and it comes off this design. Other designs that use
              it show a missing image. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={handleDelete}
            >
              {isPending ? <Spinner data-icon="inline-start" /> : null}
              Delete for everyone
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PanelSection>
  );
};
