import type { DesignDocument } from "@/lib/document/schema";
import type { EditorAsset } from "@/lib/editor/store";

// Ids per lookup request (GET /api/designs/[id]/assets)
export const MAX_ASSET_LOOKUP = 100;

// Asset ids this editor can't draw yet: images whose asset it hasn't seen
// (a collaborator's fresh upload, a paste from another design) and the
// originals behind known cutouts, which "Restore original" switches back to
export const unknownAssetIds = (
  document: DesignDocument,
  assets: readonly EditorAsset[],
  skip: (id: string) => boolean
): string[] => {
  const known = new Set(assets.map((asset) => asset.id));
  const wanted = new Set<string>();
  for (const element of document.elements) {
    if (element.type === "image") {
      wanted.add(element.assetId);
    }
  }
  for (const asset of assets) {
    if (asset.sourceAssetId) {
      wanted.add(asset.sourceAssetId);
    }
  }
  return [...wanted].filter((id) => !(known.has(id) || skip(id)));
};

export interface AssetResolver {
  // Settles once each id was found or reported missing (or the lookup
  // failed, in which case a later call asks again)
  resolve: (ids: readonly string[]) => Promise<void>;
  isPending: (id: string) => boolean;
}

// Batches the lookups asked for in one tick into one request and never asks
// for an id that's already on its way
export const createAssetResolver = ({
  lookup,
  onFound,
  onMissing,
}: {
  lookup: (ids: string[]) => Promise<EditorAsset[]>;
  onFound: (assets: EditorAsset[]) => void;
  onMissing: (ids: string[]) => void;
}): AssetResolver => {
  const inFlight = new Map<string, Promise<void>>();
  let queued: string[] = [];
  let next: PromiseWithResolvers<undefined> | null = null;

  const run = async (ids: string[], done: PromiseWithResolvers<undefined>) => {
    try {
      const found = await lookup(ids);
      onFound(found);
      const foundIds = new Set(found.map((asset) => asset.id));
      const missing = ids.filter((id) => !foundIds.has(id));
      if (missing.length > 0) {
        onMissing(missing);
      }
    } catch {
      // Offline or a server error: the next request for these ids retries
    } finally {
      for (const id of ids) {
        inFlight.delete(id);
      }
      done.resolve(undefined);
    }
  };

  const enqueue = (id: string): Promise<undefined> => {
    if (!next) {
      const batch = Promise.withResolvers<undefined>();
      next = batch;
      queueMicrotask(() => {
        const ids = queued;
        queued = [];
        next = null;
        run(ids, batch).catch(() => null);
      });
    }
    queued.push(id);
    return next.promise;
  };

  return {
    isPending: (id) => inFlight.has(id),
    resolve: async (ids) => {
      const waits = new Set<Promise<void>>();
      for (const id of ids) {
        let pending = inFlight.get(id);
        if (!pending) {
          pending = enqueue(id);
          inFlight.set(id, pending);
        }
        waits.add(pending);
      }
      await Promise.all(waits);
    },
  };
};
