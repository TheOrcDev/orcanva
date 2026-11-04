import { z } from "zod";

import {
  MAX_CANVAS_SIZE,
  MAX_ELEMENTS,
  MAX_ELEMENT_JSON_LENGTH,
  MIN_CANVAS_SIZE,
  backgroundSchema,
  elementSchema,
  keepUnknownFields,
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

// A whole design at a new size, made in the browser from one the viewer
// can open (Magic Resize's copies): its elements keep their ids and
// z-order keys, which only need to be unique within the design
export const resizedCopyInput = z.object({
  background: backgroundSchema,
  elements: z
    .array(z.object({ data: elementData, position: positionKey }))
    .max(MAX_ELEMENTS)
    .refine(
      (elements) =>
        new Set(elements.map(({ data }) => data.id)).size === elements.length,
      { message: "Element ids must be unique" }
    ),
  height: canvasSize,
  name: designName,
  sourceId: z.uuid(),
  width: canvasSize,
});

export type ResizedCopyInput = z.input<typeof resizedCopyInput>;

// The most a resized copy may be as JSON: the Server Action body limit
// (4 MB in next.config.ts), less room for the request's own wrapping
export const MAX_COPY_BYTES = 4 * 1024 * 1024 - 64 * 1024;
