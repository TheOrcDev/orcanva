import { redirect } from "next/navigation";

import { createDesign } from "@/lib/actions/designs";
import { signUpUrl } from "@/lib/auth/redirect";
import { getViewer } from "@/lib/auth/server";
import { SIZE_PRESETS } from "@/lib/document/presets";
import { STUDIO_PATH, newDesignPath } from "@/lib/routes";

// "Make one" on the landing's pages: a private design at that preset's size,
// opened in the editor. Guests sign up first (sign-in is a link away) and
// come back here, and a size that doesn't exist (an old link) goes to the
// studio to pick one. Links to it are plain <a>s, never prefetched, and
// robots.txt keeps crawlers out.
export const GET = async (
  _request: Request,
  context: RouteContext<"/new/[preset]">
) => {
  const { preset: id } = await context.params;
  const preset = SIZE_PRESETS.find((candidate) => candidate.id === id);
  if (!preset) {
    redirect(STUDIO_PATH);
  }
  if (!(await getViewer())) {
    redirect(signUpUrl(newDesignPath(preset.id)));
  }
  const design = await createDesign({
    height: preset.height,
    name: preset.label,
    visibility: "private",
    width: preset.width,
  });
  redirect(`/design/${design.id}`);
};
