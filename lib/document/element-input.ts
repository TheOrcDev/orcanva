import { z } from "zod";

import {
  MAX_CANVAS_SIZE,
  MAX_ELEMENTS,
  MAX_ELEMENT_JSON_LENGTH,
  MAX_PAGES,
  MIN_CANVAS_SIZE,
  backgroundSchema,
  elementSchema,
  keepUnknownFields,
  pageIdSchema,
} from "@/lib/document/schema";

// What a client may write as a design's elements, wherever it writes them
// (the changes route, a resized copy): the same checks, so no path stores
// anything another wouldn't.

// Fractional-index keys are base-62 digits
export const POSITION_KEY = /^[0-9A-Za-z]{2,200}$/u;

export const canvasSize = z
  .number()
  .int()
  .min(MIN_CANVAS_SIZE)
  .max(MAX_CANVAS_SIZE);

export const designName = z.string().trim().min(1).max(120);

// Validated like any element, but stored with the fields this version
// doesn't know yet, so a newer editor's additions survive an older one
export const elementData = z
  .unknown()
  .refine(
    (raw) => (JSON.stringify(raw) ?? "").length <= MAX_ELEMENT_JSON_LENGTH,
    {
      message: "Element too large",
    }
  )
  .transform((raw, context) => {
    const parsed = elementSchema.safeParse(raw);
    if (!parsed.success) {
      context.addIssue({
        code: "custom",
        message: z.prettifyError(parsed.error),
      });
      return z.NEVER;
    }
    return keepUnknownFields(raw, parsed.data);
  });

export const positionKey = z.string().regex(POSITION_KEY);

// One page of a copy: its id, place and background, and its elements
const copyPage = z.object({
  background: backgroundSchema,
  elements: z
    .array(z.object({ data: elementData, position: positionKey }))
    .max(MAX_ELEMENTS),
  id: pageIdSchema,
  position: positionKey,
});

// A whole design at a new size, made in the browser from one the viewer
// can open (Magic Resize's copies): every page, its elements keeping their
// ids and z-order keys and its pages theirs, which only need to be unique
// within the design. At most MAX_ELEMENTS elements across the pages.
export const resizedCopyInput = z.object({
  height: canvasSize,
  name: designName,
  pages: z
    .array(copyPage)
    .min(1)
    .max(MAX_PAGES)
    .refine(
      (pages) => new Set(pages.map((page) => page.id)).size === pages.length,
      { message: "Page ids must be unique" }
    )
    .refine(
      (pages) =>
        pages.reduce((total, page) => total + page.elements.length, 0) <=
        MAX_ELEMENTS,
      { message: `At most ${MAX_ELEMENTS} elements` }
    )
    .refine(
      (pages) => {
        const ids = pages.flatMap((page) =>
          page.elements.map(({ data }) => data.id)
        );
        return new Set(ids).size === ids.length;
      },
      { message: "Element ids must be unique" }
    ),
  sourceId: z.uuid(),
  width: canvasSize,
});

export type ResizedCopyInput = z.input<typeof resizedCopyInput>;

// The most a resized copy may be as JSON: the Server Action body limit
// (4 MB in next.config.ts), less room for the request's own wrapping
export const MAX_COPY_BYTES = 4 * 1024 * 1024 - 64 * 1024;
