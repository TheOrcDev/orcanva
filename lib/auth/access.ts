// Who may do what with a design. The SQL in Route Handlers mirrors this
// through visibleTo() in lib/db/queries/designs.ts (plain equality, never IS
// NOT DISTINCT FROM: a guest must not "own" a design that has no owner).

export type Visibility = "private" | "public";

// owner: everything, including rename, delete, visibility and sharing.
// member: the owner shared it with them; edits the canvas, public or private.
// editor: open it and edit the canvas (anyone, on a public design).
export type DesignRole = "owner" | "member" | "editor";

export interface DesignAccess {
  ownerId: string | null;
  visibility: Visibility;
}

// null means the viewer can't see the design at all: answer 404, so a
// private design doesn't even reveal that it exists. `isShared`: the owner
// shared it with the viewer (see design_shares).
export const roleFor = (
  { ownerId, visibility }: DesignAccess,
  viewerId: string | null,
  isShared: boolean
): DesignRole | null => {
  if (viewerId !== null && ownerId === viewerId) {
    return "owner";
  }
  if (viewerId !== null && isShared) {
    return "member";
  }
  return visibility === "public" ? "editor" : null;
};

// People it's shared with keep it when it goes private; everyone else who
// isn't the owner loses it
export const keepsPrivateAccess = (role: DesignRole): boolean =>
  role !== "editor";
