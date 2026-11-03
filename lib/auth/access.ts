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

// Version history: the owner and people it's shared with. Public editors
// and guests don't see it, since old versions can hold what the owner
// removed on purpose (and their asset URLs work as capabilities).
export const canManageHistory = (role: DesignRole): boolean =>
  role !== "editor";

// Comments. Anyone who can open a design reads them. Writing one takes an
// account (guests choose their own names, and there'd be nothing to
// rate-limit), and the routes mirror each rule in their SQL.
export const canComment = (
  role: DesignRole | null,
  viewerId: string | null
): boolean => role !== null && viewerId !== null;

// Mentioning (and being mentioned): the owner and people it's shared with,
// so a public design's visitors can't fill the owner's inbox
export const canMention = (role: DesignRole | null): boolean =>
  role === "owner" || role === "member";

// Changing a comment's text: its author alone
export const canEditComment = (
  viewerId: string | null,
  authorId: string | null
): boolean => viewerId !== null && viewerId === authorId;

// Deleting one: its author, or the design's owner, who moderates
export const canDeleteComment = (
  role: DesignRole | null,
  viewerId: string | null,
  authorId: string | null
): boolean => canEditComment(viewerId, authorId) || role === "owner";

// Resolving or reopening a thread: the owner, people it's shared with, and
// whoever started the thread
export const canResolveThread = (
  role: DesignRole | null,
  viewerId: string | null,
  threadAuthorId: string | null
): boolean => canMention(role) || canEditComment(viewerId, threadAuthorId);
