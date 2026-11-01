import type { DesignDocument, DesignElement } from "@/lib/document/schema";
import { groupResolver } from "@/lib/editor/groups";

// One row of the Layers panel: an element, or a group with its members.
// Lists run from the top of the stack down.
export type LayerItem =
  | { kind: "element"; element: DesignElement }
  | { kind: "group"; groupId: string; members: DesignElement[] };

export const GROUP_KEY_PREFIX = "group:";

// The id a row sorts by
export const layerKey = (item: LayerItem): string =>
  item.kind === "group"
    ? `${GROUP_KEY_PREFIX}${item.groupId}`
    : item.element.id;

// A group sits where its topmost member is, with every member under it (even
// ones arranged away from the rest)
export const layerItems = (document: DesignDocument): LayerItem[] => {
  const items: LayerItem[] = [];
  const groupFor = groupResolver(document);
  const groups = new Map<string, DesignElement[]>();
  for (const element of document.elements.toReversed()) {
    const groupId = groupFor(element);
    if (!groupId) {
      items.push({ element, kind: "element" });
      continue;
    }
    const members = groups.get(groupId);
    if (members) {
      members.push(element);
    } else {
      const created = [element];
      groups.set(groupId, created);
      items.push({ groupId, kind: "group", members: created });
    }
  }
  return items;
};

// Element ids from the bottom of the stack up, the document's order
export const flattenLayers = (items: readonly LayerItem[]): string[] =>
  items
    .flatMap((item) =>
      item.kind === "group"
        ? item.members.map((member) => member.id)
        : [item.element.id]
    )
    .toReversed();

const moveItem = <T>(list: readonly T[], from: number, to: number): T[] => {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  if (moved !== undefined) {
    next.splice(to, 0, moved);
  }
  return next;
};

// Drops one row onto another's place: rows at the top level move past each
// other (a group as one block, and a drop on a member counts as one on its
// group), members only within their own group. Anything else isn't a move.
export const moveLayer = (
  items: readonly LayerItem[],
  activeKey: string,
  overKey: string
): LayerItem[] | null => {
  const keys = items.map(layerKey);
  const from = keys.indexOf(activeKey);
  if (from !== -1) {
    // Dropped on a group's member counts as dropped on the group
    const to = items.findIndex(
      (item) =>
        layerKey(item) === overKey ||
        (item.kind === "group" &&
          item.members.some((member) => member.id === overKey))
    );
    return to === -1 || to === from ? null : moveItem(items, from, to);
  }
  for (const [index, item] of items.entries()) {
    if (item.kind !== "group") {
      continue;
    }
    const ids = item.members.map((member) => member.id);
    const memberFrom = ids.indexOf(activeKey);
    const memberTo = ids.indexOf(overKey);
    if (memberFrom !== -1 && memberTo !== -1 && memberFrom !== memberTo) {
      const next = [...items];
      next[index] = {
        ...item,
        members: moveItem(item.members, memberFrom, memberTo),
      };
      return next;
    }
  }
  return null;
};
