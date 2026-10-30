// Who may do what with a design. The SQL in Route Handlers mirrors this as
// `visibility = 'public' OR owner_id = $viewer` (plain equality, never IS NOT
// DISTINCT FROM: a guest must not "own" a design that has no owner).

export type Visibility = "private" | "public";

// owner: everything, including rename, delete and visibility.
// editor: open it and edit the canvas (anyone, on a public design).
export type DesignRole = "owner" | "editor";

export interface DesignAccess {
  ownerId: string | null;
  visibility: Visibility;
}

// null means the viewer can't see the design at all: answer 404, so a
// private design doesn't even reveal that it exists
export const roleFor = (
  { ownerId, visibility }: DesignAccess,
  viewerId: string | null
): DesignRole | null => {
  if (viewerId !== null && ownerId === viewerId) {
    return "owner";
  }
  return visibility === "public" ? "editor" : null;
};
