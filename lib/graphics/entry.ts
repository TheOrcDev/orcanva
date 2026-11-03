import { z } from "zod";

import { graphicElementSchema } from "@/lib/document/schema";

// The kinds the Graphics tab knows. Elements keep `kind` as a plain string,
// so a newer kind still draws in an older tab.
export const GRAPHIC_KINDS = ["icon", "emoji", "sticker"] as const;
export type GraphicKind = (typeof GRAPHIC_KINDS)[number];

// The art itself, as a graphic element carries it
export const graphicArtSchema = graphicElementSchema.pick({
  layers: true,
  palette: true,
  viewBox: true,
});
export type GraphicArt = z.infer<typeof graphicArtSchema>;

// One graphic to add: built in, from the catalog, or dragged onto the
// canvas. The id ("tabler:flame") becomes the element's source.
export const graphicEntrySchema = graphicArtSchema.extend({
  id: z.string().min(1).max(96),
  kind: z.enum(GRAPHIC_KINDS),
  name: z.string().min(1).max(120),
});
export type GraphicEntry = z.infer<typeof graphicEntrySchema>;

// The build drops anything bigger, well under an element's 64 KB limit
export const MAX_GRAPHIC_JSON_LENGTH = 24_000;
