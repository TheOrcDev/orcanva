import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { getDesign } from "@/lib/db/queries/designs";
import { migrateDocument } from "@/lib/document/migrate";

const loadDesign = async (id: string) => {
  await connection();
  const row = await getDesign(id);
  if (!row) {
    notFound();
  }
  return { ...row, document: migrateDocument(row.document) };
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

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-2">
      <h1 className="font-heading text-xl font-semibold">{design.name}</h1>
      <p className="text-muted-foreground text-sm">
        {design.document.width} × {design.document.height} ·{" "}
        {design.document.elements.length} elements
      </p>
    </main>
  );
};

export default DesignPage;
