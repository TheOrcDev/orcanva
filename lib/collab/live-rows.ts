import type { Entry, PageSettings } from "@/lib/collab/changeset";
import { isDeepEqual } from "@/lib/collab/equal";
import { backgroundSchema, parseElement } from "@/lib/document/schema";
import type { LiveElementRow, LivePageRow } from "@/lib/realtime/rows";

// Turns live element rows into entries. Rows whose content is unchanged
// keep their previous entry (no re-validation, same identity); rows that
// don't validate are skipped rather than breaking the whole design, and
// their ids are listed: usually a newer Orcanva wrote them (an element type
// this tab doesn't know), so a reload shows them.
export const entriesFromRows = (
  rows: readonly LiveElementRow[],
  previous: ReadonlyMap<string, Entry>
): { entries: Map<string, Entry>; skipped: string[] } => {
  const entries = new Map<string, Entry>();
  const skipped: string[] = [];
  for (const row of rows) {
    const known = previous.get(row.id);
    if (
      known &&
      known.position === row.position &&
      isDeepEqual(known.element, row.data)
    ) {
      entries.set(row.id, known);
      continue;
    }
    const element = parseElement(row.data);
    if (element?.id === row.id) {
      entries.set(row.id, { element, position: row.position });
    } else {
      skipped.push(row.id);
    }
  }
  return { entries, skipped };
};

export const pageFromRow = (
  row: LivePageRow
): { page: PageSettings; name: string } | null => {
  const background = backgroundSchema.safeParse(row.background);
  if (!background.success) {
    return null;
  }
  return {
    name: row.name,
    page: { background: background.data, height: row.height, width: row.width },
  };
};
