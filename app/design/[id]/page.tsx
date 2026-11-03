import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { EditorLoader } from "@/components/editor/editor-loader";
import { roleFor } from "@/lib/auth/access";
import { getViewer } from "@/lib/auth/server";
import { listDesignAssets, listLibrary } from "@/lib/db/queries/assets";
import { getBrandKit } from "@/lib/db/queries/brand-kit";
import {
  getDesign,
  getDesignContent,
  getDesignRole,
  isDesignSharedWith,
} from "@/lib/db/queries/designs";
import { getLiveConfig } from "@/lib/realtime/server";

const loadDesign = async (id: string) => {
  await connection();
  // Everything loads alongside the access check (sealing is local crypto),
  // but only leaves the server once the check has passed
  const viewerLoad = getViewer();
  const [viewer, content, live, designAssets, library, isShared, brandKit] =
    await Promise.all([
      viewerLoad,
      getDesignContent(id),
      getLiveConfig(id),
      listDesignAssets(id),
      viewerLoad.then((found) => (found ? listLibrary(found.id) : [])),
      viewerLoad.then((found) => isDesignSharedWith(id, found?.id ?? null)),
      viewerLoad.then((found) => (found ? getBrandKit(found.id) : null)),
    ]);
  const role = content
    ? roleFor(content.row, viewer?.id ?? null, isShared)
    : null;
  if (!(content && role)) {
    notFound();
  }
  // The viewer's library first, then what the design shows from others
  const libraryIds = new Set(library.map((asset) => asset.id));
  return {
    assets: [
      ...library,
      ...designAssets.filter((asset) => !libraryIds.has(asset.id)),
    ],
    brandKit,
    designId: content.row.id,
    document: content.document,
    hasThumbnail: content.row.thumbnailKey !== null,
    libraryIds: [...libraryIds],
    live,
    name: content.row.name,
    positions: content.positions,
    role,
    viewer: viewer
      ? { id: viewer.id, image: viewer.image, name: viewer.name }
      : null,
    visibility: content.row.visibility,
  };
};

export const generateMetadata = async (
  props: PageProps<"/design/[id]">
): Promise<Metadata> => {
  const { id } = await props.params;
  const viewer = await getViewer();
  const [design, role] = await Promise.all([
    getDesign(id),
    getDesignRole(id, viewer?.id ?? null),
  ]);
  const visible = design && role;
  // The editor draws in the browser, so a crawler sees an empty page
  return {
    robots: { index: false },
    title: visible ? design.name : "Design not found",
  };
};

const DesignPage = async (props: PageProps<"/design/[id]">) => {
  const { id } = await props.params;
  const design = await loadDesign(id);

  return <EditorLoader {...design} />;
};

export default DesignPage;
