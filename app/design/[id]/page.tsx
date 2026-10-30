import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { EditorLoader } from "@/components/editor/editor-loader";
import { getDesign } from "@/lib/db/queries/designs";
import { migrateDocument } from "@/lib/document/migrate";

const loadDesign = async (id: string) => {
  await connection();
  const row = await getDesign(id);
  if (!row) {
    notFound();
  }
  return {
    assets: [],
    designId: row.id,
    document: migrateDocument(row.document),
    hasThumbnail: row.thumbnailKey !== null,
    name: row.name,
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
