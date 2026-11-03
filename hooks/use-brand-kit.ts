"use client";

import { useCallback } from "react";

import { useEditorStoreApi } from "@/components/editor/editor-store-context";
import { toast } from "@/components/ui/toast";
import { changeBrandKit } from "@/lib/brand-kit/change";
import type { UpdateBrandKit } from "@/lib/brand-kit/change";
import type { BrandKitItem } from "@/lib/brand-kit/schema";
import { stopIfOutdated } from "@/lib/editor/outdated";
import type { EditorAsset, EditorStoreApi } from "@/lib/editor/store";

const storeUpdater =
  (store: EditorStoreApi): UpdateBrandKit =>
  (recipe) => {
    const kit = store.getState().brandKit;
    if (kit) {
      store.getState().setBrandKit(recipe(kit));
    }
  };

// Adds to or removes from the viewer's brand kit from inside the editor.
// Guests have no kit, so it does nothing for them.
export const useBrandKitChange = () => {
  const store = useEditorStoreApi();
  return useCallback(
    async (item: BrandKitItem, add: boolean, logo?: EditorAsset) => {
      if (!store.getState().brandKit) {
        return;
      }
      try {
        const refusal = await changeBrandKit(
          storeUpdater(store),
          item,
          add,
          logo
        );
        if (refusal) {
          toast.add({ title: refusal, type: "error" });
        }
      } catch (error) {
        // After a deploy the reload prompt says it all
        if (!stopIfOutdated(store, error)) {
          toast.add({
            title: add
              ? "Couldn't add that to your brand kit"
              : "Couldn't remove that from your brand kit",
            type: "error",
          });
        }
      }
    },
    [store]
  );
};
