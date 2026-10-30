import { DOCUMENT_VERSION, designDocumentSchema } from "@/lib/document/schema";
import type { DesignDocument } from "@/lib/document/schema";

type Upgrade = (raw: Record<string, unknown>) => Record<string, unknown>;

// Index n upgrades a document from version n + 1 to n + 2. Append a step
// here whenever DOCUMENT_VERSION is bumped.
const upgrades: Upgrade[] = [];

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

  return designDocumentSchema.parse(current);
};
