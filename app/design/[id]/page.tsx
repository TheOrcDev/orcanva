import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { EditorLoader } from "@/components/editor/editor-loader";
import { listReadyAssets } from "@/lib/db/queries/assets";
import { getDesign, getDesignContent } from "@/lib/db/queries/designs";
import { getLiveConfig } from "@/lib/realtime/server";

const loadDesign = async (id: string) => {
  await connection();
  const [content, assets, live] = await Promise.all([
    getDesignContent(id),
    listReadyAssets(),
    getLiveConfig(id),
  ]);
  if (!content) {
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
  };
};

export const generateMetadata = async (
  props: PageProps<"/design/[id]">
): Promise<Metadata> => {
  const { id } = await props.params;
  const design = await getDesign(id);
  return { title: design?.name ?? "Design not found" };
};

const DesignPage = async (props: PageProps<"/design/[id]">) => {
  const { id } = await props.params;
  const design = await loadDesign(id);

  return <EditorLoader {...design} />;
};

export default DesignPage;
