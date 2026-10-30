import "server-only";
import type { DesignRole } from "@/lib/auth/access";
import { getViewer } from "@/lib/auth/server";
import type { Viewer } from "@/lib/auth/server";
import { getDesignRole } from "@/lib/db/queries/designs";

// Who is asking and what they may do with the design; a null role means
// "answer 404" (a private design doesn't reveal that it exists)
export const getDesignAccess = async (
  designId: string
): Promise<{ viewer: Viewer | null; role: DesignRole | null }> => {
  const viewer = await getViewer();
  const role = await getDesignRole(designId, viewer?.id ?? null);
  return { role, viewer };
};
