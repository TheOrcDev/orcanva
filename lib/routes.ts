// Where the gallery of designs lives; `/` is the landing page. It sends
// people on to one of the two pages below: their private designs when signed
// in, the public ones otherwise.
export const STUDIO_PATH = "/studio";

// The signed-in person's private designs
export const PRIVATE_DESIGNS_PATH = "/studio/private";

// Other people's designs shared with the signed-in person
export const SHARED_DESIGNS_PATH = "/studio/shared";

// Everyone's public designs, the viewer's own included
export const PUBLIC_DESIGNS_PATH = "/studio/public";

// ?owner= on the public designs, narrowing them to the viewer's own
export const OWNER_MINE = "mine";
export const MY_PUBLIC_DESIGNS_PATH = `${PUBLIC_DESIGNS_PATH}?owner=${OWNER_MINE}`;

// The signed-in person's profile: name and picture
export const SETTINGS_PATH = "/settings";

// /invite/<token>: the link in a share email, which opens the design once
// the right account is signed in
export const INVITE_PATH = "/invite";

// /new/<size preset id> makes a private design at that size and opens it,
// after signing in; ?template=<id> makes it from that template. The
// landing's pages link to it from each size and template.
export const NEW_DESIGN_PATH = "/new";
export const TEMPLATE_PARAM = "template";
export const newDesignPath = (presetId: string, templateId?: string): string =>
  templateId
    ? `${NEW_DESIGN_PATH}/${presetId}?${TEMPLATE_PARAM}=${encodeURIComponent(templateId)}`
    : `${NEW_DESIGN_PATH}/${presetId}`;

// The landing's pages for what people search for, beside `/`
export const BACKGROUND_REMOVER_PATH = "/background-remover";
export const TEMPLATES_PATH = "/templates";
export const CANVA_ALTERNATIVE_PATH = "/canva-alternative";
export const REMOVE_BG_ALTERNATIVE_PATH = "/remove-bg-alternative";
export const IMAGE_SIZES_PATH = "/social-media-image-sizes";
export const REMOVE_AI_METADATA_PATH = "/remove-ai-metadata";
export const YOUTUBE_PREVIEW_PATH = "/youtube-thumbnail-preview";
