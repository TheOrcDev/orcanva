import { z } from "zod";

import { createId } from "@/lib/document/factories";
import { parseElement } from "@/lib/document/schema";
import type { DesignElement } from "@/lib/document/schema";

// Elements travel through the system clipboard as tagged JSON, so copy and
// paste work across designs and tabs (assets are a shared library)
const CLIPBOARD_PREFIX = "orcanva/elements:";
const PASTE_OFFSET = 24;

const payloadSchema = z.object({
  elements: z.array(z.unknown()).min(1).max(100),
  version: z.literal(1),
});

export const serializeElements = (elements: DesignElement[]): string =>
  `${CLIPBOARD_PREFIX}${JSON.stringify({ elements, version: 1 })}`;

export const parseClipboardElements = (
  text: string
): DesignElement[] | null => {
  if (!text.startsWith(CLIPBOARD_PREFIX)) {
    return null;
  }
  try {
    const parsed = payloadSchema.safeParse(
      JSON.parse(text.slice(CLIPBOARD_PREFIX.length))
    );
    if (!parsed.success) {
      return null;
    }
    const elements: DesignElement[] = [];
    for (const raw of parsed.data.elements) {
      const element = parseElement(raw);
      if (!element) {
        return null;
      }
      elements.push(element);
    }
    return elements;
  } catch {
    return null;
  }
};

// Fresh ids, unlocked, and nudged so pasted copies don't hide the originals
export const preparePastedElements = (
  elements: DesignElement[]
): DesignElement[] =>
  elements.map((element) => ({
    ...element,
    id: createId(),
    locked: false,
    x: element.x + PASTE_OFFSET,
    y: element.y + PASTE_OFFSET,
  }));
