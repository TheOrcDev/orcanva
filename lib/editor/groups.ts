import { createId } from "@/lib/document/factories";
import type { DesignDocument, DesignElement } from "@/lib/document/schema";

// How many elements share each group id. A group only counts with two or
// more members, so one left alone (others deleted) acts ungrouped without a
// cleanup write.
const memberCounts = (document: DesignDocument): Map<string, number> => {
  const counts = new Map<string, number>();
  for (const { groupId } of document.elements) {
    if (groupId) {
      counts.set(groupId, (counts.get(groupId) ?? 0) + 1);
    }
  }
  return counts;
};

// The group an element is in, or null when it stands alone
export const groupOf = (
  document: DesignDocument,
  element: DesignElement
): string | null =>
  element.groupId && (memberCounts(document).get(element.groupId) ?? 0) > 1
    ? element.groupId
    : null;

// What selecting an element picks: its whole group, or just itself
export const unitOf = (document: DesignDocument, id: string): string[] => {
  const element = document.elements.find((item) => item.id === id);
  const groupId = element ? groupOf(document, element) : null;
  if (!groupId) {
    return element ? [id] : [];
  }
  return document.elements
    .filter((item) => item.groupId === groupId)
    .map((item) => item.id);
};

// Adds every member of any group that's partly selected, in z-order
export const expandToGroups = (
  document: DesignDocument,
  ids: readonly string[]
): string[] => {
  const counts = memberCounts(document);
  const selected = new Set(ids);
  const groups = new Set(
    document.elements
      .filter((element) => selected.has(element.id) && element.groupId)
      .map((element) => element.groupId)
  );
  const expanded = document.elements
    .filter(
      (element) =>
        selected.has(element.id) ||
        (element.groupId !== null &&
          groups.has(element.groupId) &&
          (counts.get(element.groupId) ?? 0) > 1)
    )
    .map((element) => element.id);
  // Keep ids the document doesn't know yet (e.g. just pasted)
  return [...expanded, ...ids.filter((id) => !expanded.includes(id))];
};

// The selection split into what moves as one: each group, and each element
// on its own
export const selectionUnits = (
  document: DesignDocument,
  ids: readonly string[]
): string[][] => {
  const selected = new Set(ids);
  const units = new Map<string, string[]>();
  for (const element of document.elements) {
    if (!selected.has(element.id)) {
      continue;
    }
    const key = groupOf(document, element) ?? `element:${element.id}`;
    units.set(key, [...(units.get(key) ?? []), element.id]);
  }
  return [...units.values()];
};

// The selection is exactly one whole group
export const selectedGroup = (
  document: DesignDocument,
  ids: readonly string[]
): string | null => {
  const [first] = ids;
  if (!first) {
    return null;
  }
  const unit = unitOf(document, first);
  return unit.length > 1 &&
    unit.length === ids.length &&
    unit.every((id) => ids.includes(id))
    ? (document.elements.find((element) => element.id === first)?.groupId ??
        null)
    : null;
};

// Gives the elements one new group and stacks them together where the
// topmost of them was. Grouping groups merges them: there's no nesting.
export const groupElements = (
  document: DesignDocument,
  ids: readonly string[],
  groupId: string = createId()
): DesignDocument => {
  const members = new Set(expandToGroups(document, ids));
  if (members.size < 2) {
    return document;
  }
  const topmost = document.elements.findLast((element) =>
    members.has(element.id)
  );
  const grouped = document.elements
    .filter((element) => members.has(element.id))
    .map((element) => ({ ...element, groupId }));
  const elements: DesignElement[] = [];
  for (const element of document.elements) {
    if (element === topmost) {
      elements.push(...grouped);
    } else if (!members.has(element.id)) {
      elements.push(element);
    }
  }
  return { ...document, elements };
};

// Takes every element of the selected groups out of them
export const ungroupElements = (
  document: DesignDocument,
  ids: readonly string[]
): DesignDocument => {
  const members = new Set(expandToGroups(document, ids));
  let changed = false;
  const elements = document.elements.map((element) => {
    if (!members.has(element.id) || element.groupId === null) {
      return element;
    }
    changed = true;
    return { ...element, groupId: null };
  });
  return changed ? { ...document, elements } : document;
};

// Copies of grouped elements form new groups of their own; a copy whose
// group-mates weren't copied stands alone
export const regroupCopies = <T extends DesignElement>(copies: T[]): T[] => {
  const counts = new Map<string, number>();
  for (const { groupId } of copies) {
    if (groupId) {
      counts.set(groupId, (counts.get(groupId) ?? 0) + 1);
    }
  }
  const fresh = new Map<string, string>();
  return copies.map((copy) => {
    if (!copy.groupId) {
      return copy;
    }
    if ((counts.get(copy.groupId) ?? 0) < 2) {
      return { ...copy, groupId: null };
    }
    const groupId = fresh.get(copy.groupId) ?? createId();
    fresh.set(copy.groupId, groupId);
    return { ...copy, groupId };
  });
};
