import { describe, expect, it } from "vitest";

import { createDocument, createImageElement } from "@/lib/document/factories";
import type { DesignDocument } from "@/lib/document/schema";
import {
  createAssetResolver,
  unknownAssetIds,
} from "@/lib/editor/asset-resolver";
import type { EditorAsset } from "@/lib/editor/store";

const PAGE = { height: 720, width: 1280 };

const asset = (id: string, sourceAssetId: string | null = null) =>
  ({
    height: 100,
    id,
    name: id,
    sourceAssetId,
    url: `/api/storage/assets/${id}.png`,
    width: 100,
  }) satisfies EditorAsset;

const withImages = (...assetIds: string[]): DesignDocument => ({
  ...createDocument(PAGE),
  elements: assetIds.map((id) => createImageElement(asset(id), PAGE)),
});

const never = () => false;

describe("unknownAssetIds", () => {
  it("lists images whose asset the editor hasn't seen", () => {
    const document = withImages("a", "b", "b");
    expect(unknownAssetIds(document, [asset("a")], never)).toEqual(["b"]);
  });

  it("asks for the originals behind known cutouts", () => {
    const document = withImages("cutout");
    expect(
      unknownAssetIds(document, [asset("cutout", "original")], never)
    ).toEqual(["original"]);
  });

  it("skips ids that are pending or known to be missing", () => {
    const document = withImages("a", "b");
    expect(unknownAssetIds(document, [], (id) => id === "a")).toEqual(["b"]);
  });
});

const setup = (lookup: (ids: string[]) => Promise<EditorAsset[]>) => {
  const calls: string[][] = [];
  const found: string[] = [];
  const missing: string[] = [];
  const resolver = createAssetResolver({
    lookup: (ids) => {
      calls.push(ids);
      return lookup(ids);
    },
    onFound: (assets) => found.push(...assets.map((item) => item.id)),
    onMissing: (ids) => missing.push(...ids),
  });
  return { calls, found, missing, resolver };
};

const lookupExisting =
  (...existing: string[]) =>
  (ids: string[]) =>
    Promise.resolve(
      ids.filter((id) => existing.includes(id)).map((id) => asset(id))
    );

describe("createAssetResolver", () => {
  it("batches lookups asked for in the same tick", async () => {
    const { calls, found, resolver } = setup(lookupExisting("a", "b"));
    await Promise.all([resolver.resolve(["a"]), resolver.resolve(["b"])]);
    expect(calls).toEqual([["a", "b"]]);
    expect(found).toEqual(["a", "b"]);
  });

  it("never asks twice for an id that's already on its way", async () => {
    const { calls, resolver } = setup(lookupExisting("a"));
    const first = resolver.resolve(["a"]);
    expect(resolver.isPending("a")).toBe(true);
    await resolver.resolve(["a"]);
    await first;
    expect(calls).toEqual([["a"]]);
    expect(resolver.isPending("a")).toBe(false);
  });

  it("reports ids the server doesn't have", async () => {
    const { missing, resolver } = setup(lookupExisting("a"));
    await resolver.resolve(["a", "gone"]);
    expect(missing).toEqual(["gone"]);
  });

  it("lets a failed lookup be retried", async () => {
    let fail = true;
    const { calls, found, missing, resolver } = setup((ids) =>
      fail ? Promise.reject(new Error("offline")) : lookupExisting("a")(ids)
    );
    await resolver.resolve(["a"]);
    expect(missing).toEqual([]);
    fail = false;
    await resolver.resolve(["a"]);
    expect(calls).toEqual([["a"], ["a"]]);
    expect(found).toEqual(["a"]);
  });
});
