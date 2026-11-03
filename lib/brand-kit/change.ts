import { addBrandKitItem, removeBrandKitItem } from "@/lib/actions/brand-kit";
import { withBrandItem, withoutBrandItem } from "@/lib/brand-kit/kit";
import type { BrandKit, BrandKitItem } from "@/lib/brand-kit/schema";
import type { EditorAsset } from "@/lib/editor/store";

export type UpdateBrandKit = (recipe: (kit: BrandKit) => BrandKit) => void;

// Adds an item to the viewer's brand kit or removes one, for the editor and
// Settings alike. The change shows at once through `update`, then the kit
// the server returns replaces it. Resolves with the server's reason when
// it refused; when the action fails, takes back just this change and
// throws. Pass a logo's upload along, to show it before the server answers.
export const changeBrandKit = async (
  update: UpdateBrandKit,
  item: BrandKitItem,
  add: boolean,
  logo?: EditorAsset
): Promise<string | null> => {
  update((kit) =>
    add ? withBrandItem(kit, item, logo) : withoutBrandItem(kit, item)
  );
  try {
    const result = add
      ? await addBrandKitItem(item)
      : await removeBrandKitItem(item);
    update(() => result.kit);
    return result.error;
  } catch (error) {
    update((kit) =>
      add ? withoutBrandItem(kit, item) : withBrandItem(kit, item, logo)
    );
    throw error;
  }
};
