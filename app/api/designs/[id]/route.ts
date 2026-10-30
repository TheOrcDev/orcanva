import { eq } from "drizzle-orm";
import { z } from "zod";

import { getDb } from "@/lib/db/client";
import { isDesignId } from "@/lib/db/queries/designs";
import { designs } from "@/lib/db/schema";
import { designDocumentSchema } from "@/lib/document/schema";

const savePayload = z.object({
  document: designDocumentSchema,
  name: z.string().trim().min(1).max(120),
});

const json = (body: unknown, status = 200) => Response.json(body, { status });

// Autosave endpoint. A Route Handler rather than a Server Action because
// actions run one at a time per client (saves would queue behind uploads)
// and it doubles as the keepalive target when the tab closes.
export const PUT = async (
  request: Request,
  context: RouteContext<"/api/designs/[id]">
): Promise<Response> => {
  const { id } = await context.params;
  if (!isDesignId(id)) {
    return json({ error: "Not found" }, 404);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const parsed = savePayload.safeParse(body);
  if (!parsed.success) {
    return json({ error: "Invalid design", issues: parsed.error.issues }, 422);
  }

  const { document, name } = parsed.data;
  const updatedAt = new Date();
  const [row] = await getDb()
    .update(designs)
    .set({
      document,
      height: document.height,
      name,
      updatedAt,
      width: document.width,
    })
    .where(eq(designs.id, id))
    .returning({ id: designs.id });

  if (!row) {
    return json({ error: "Not found" }, 404);
  }
  return json({ updatedAt: updatedAt.toISOString() });
};
