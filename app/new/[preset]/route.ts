import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";

import { createDesign } from "@/lib/actions/designs";
import { createDesignFromTemplate } from "@/lib/actions/templates";
import { signUpUrl } from "@/lib/auth/redirect";
import { getViewer } from "@/lib/auth/server";
import { findPresetById } from "@/lib/document/presets";
import { STUDIO_PATH, TEMPLATE_PARAM, newDesignPath } from "@/lib/routes";
import { findTemplate } from "@/lib/templates/lookup";

// "Make one" on the landing's pages: a private design at that preset's size,
// opened in the editor, made from a template when ?template= names one.
// Guests sign up first (sign-in is a link away) and come back here with the
// template still in the URL. A size that doesn't exist (an old link) goes to
// the studio to pick one, a template made for another size opens at its own
// size, and a template that doesn't exist (any more) gives a blank design.
// Links to it are plain <a>s, never prefetched, and robots.txt keeps
// crawlers out.
export const GET = async (
  request: NextRequest,
  context: RouteContext<"/new/[preset]">
) => {
  const { preset: id } = await context.params;
  const preset = findPresetById(id);
  if (!preset) {
    redirect(STUDIO_PATH);
  }
  const templateId = request.nextUrl.searchParams.get(TEMPLATE_PARAM);
  const template = templateId ? findTemplate(templateId) : undefined;
  if (template && template.presetId !== preset.id) {
    redirect(newDesignPath(template.presetId, template.id));
  }
  if (!(await getViewer())) {
    redirect(signUpUrl(newDesignPath(preset.id, template?.id)));
  }
  const design = template
    ? await createDesignFromTemplate({ templateId: template.id })
    : await createDesign({
        height: preset.height,
        name: preset.label,
        visibility: "private",
        width: preset.width,
      });
  redirect(`/design/${design.id}`);
};
