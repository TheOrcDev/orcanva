// Where the gallery of designs lives; `/` is the landing page. It sends
// people on to one of the two pages below: their private designs when signed
// in, the public ones otherwise.
export const STUDIO_PATH = "/studio";

// The signed-in person's private designs
export const PRIVATE_DESIGNS_PATH = "/studio/private";

// Everyone's public designs, the viewer's own included
export const PUBLIC_DESIGNS_PATH = "/studio/public";

// ?owner= on the public designs, narrowing them to the viewer's own
export const OWNER_MINE = "mine";
export const MY_PUBLIC_DESIGNS_PATH = `${PUBLIC_DESIGNS_PATH}?owner=${OWNER_MINE}`;

// The signed-in person's profile: name and picture
export const SETTINGS_PATH = "/settings";

// /new/<size preset id> makes a private design at that size and opens it,
// after signing in. The landing's pages link to it from each size.
export const NEW_DESIGN_PATH = "/new";
export const newDesignPath = (presetId: string): string =>
  `${NEW_DESIGN_PATH}/${presetId}`;

// The landing's pages for what people search for, beside `/`
export const BACKGROUND_REMOVER_PATH = "/background-remover";
export const CANVA_ALTERNATIVE_PATH = "/canva-alternative";
export const REMOVE_BG_ALTERNATIVE_PATH = "/remove-bg-alternative";
export const IMAGE_SIZES_PATH = "/social-media-image-sizes";
