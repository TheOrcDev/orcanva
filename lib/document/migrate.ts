import {
  DOCUMENT_VERSION,
  designDocumentSchema,
  parseElement,
} from "@/lib/document/schema";
import type { DesignDocument } from "@/lib/document/schema";

type Upgrade = (raw: Record<string, unknown>) => Record<string, unknown>;

// Index n upgrades a document from version n + 1 to n + 2. Append a step
// here whenever DOCUMENT_VERSION is bumped.
const upgrades: Upgrade[] = [
  // 1 → 2: pages arrived. A page's document is what a whole design's was,
  // so nothing in it changes; a design's version says whether code from
  // before pages can still edit it (see documentVersionFor).
  (raw) => ({ ...raw, version: 2 }),
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const migrateDocument = (raw: unknown): DesignDocument => {
  if (!isRecord(raw)) {
    throw new Error("Design document must be an object");
  }

  let current = raw;
  let version = typeof current.version === "number" ? current.version : 1;

  if (version > DOCUMENT_VERSION) {
    throw new Error(
      `Design document version ${version} is newer than supported version ${DOCUMENT_VERSION}`
    );
  }

  while (version < DOCUMENT_VERSION) {
    const upgrade = upgrades[version - 1];
    if (!upgrade) {
      throw new Error(`No upgrade path from document version ${version}`);
    }
    current = upgrade(current);
    version += 1;
  }

  if (!Array.isArray(current.elements)) {
    throw new TypeError("Design document must list its elements");
  }
  // Elements this code can't read (a newer element type, say) are left out
  // rather than keeping the whole design from opening
  const elements = current.elements.flatMap(
    (element) => parseElement(element) ?? []
  );
  const document = designDocumentSchema.parse({ ...current, elements });
  // parseElement kept the fields this version doesn't know; parse drops them
  return { ...document, elements };
};
