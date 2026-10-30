import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { EditorLoader } from "@/components/editor/editor-loader";
import { roleFor } from "@/lib/auth/access";
import { getViewer } from "@/lib/auth/server";
import { listReadyAssets } from "@/lib/db/queries/assets";
import { getDesign, getDesignContent } from "@/lib/db/queries/designs";
import { getLiveConfig } from "@/lib/realtime/server";

const loadDesign = async (id: string) => {
  await connection();
  // Sealing is local crypto, so it runs alongside the access check; the
  // sealed queries only leave the server once the check has passed
  const [viewer, content, assets, live] = await Promise.all([
    getViewer(),
    getDesignContent(id),
    listReadyAssets(),
    getLiveConfig(id),
  ]);
  const role = content ? roleFor(content.row, viewer?.id ?? null) : null;
  if (!(content && role)) {
    notFound();
  }
  return {
    assets,
    designId: content.row.id,
    document: content.document,
    hasThumbnail: content.row.thumbnailKey !== null,
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
  const [design, viewer] = await Promise.all([getDesign(id), getViewer()]);
  const visible = design && roleFor(design, viewer?.id ?? null);
  return { title: visible ? design.name : "Design not found" };
};

const DesignPage = async (props: PageProps<"/design/[id]">) => {
  const { id } = await props.params;
  const design = await loadDesign(id);

  return <EditorLoader {...design} />;
};

export default DesignPage;
