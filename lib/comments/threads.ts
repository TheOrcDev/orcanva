import type { DesignComment } from "@/lib/comments/schema";

// A thread is its root comment, which holds the pin, and the replies to it
export interface CommentThread {
  root: DesignComment;
  // Oldest first
  replies: DesignComment[];
}

// Timestamps are ISO strings in UTC, so they sort as text
const oldestFirst = (a: DesignComment, b: DesignComment) =>
  a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

// Comments as threads, the newest thread first. Replies whose thread isn't
// there (deleted, or not arrived yet) are left out.
export const groupThreads = (
  comments: readonly DesignComment[]
): CommentThread[] => {
  const replies = new Map<string, DesignComment[]>();
  for (const comment of comments) {
    if (comment.threadId !== null) {
      const list = replies.get(comment.threadId) ?? [];
      list.push(comment);
      replies.set(comment.threadId, list);
    }
  }
  return comments
    .filter((comment) => comment.threadId === null)
    .toSorted((a, b) => oldestFirst(b, a))
    .map((root) => ({
      replies: replies.get(root.id)?.toSorted(oldestFirst) ?? [],
      root,
    }));
};

export const isResolved = (thread: CommentThread): boolean =>
  thread.root.resolvedAt !== null;

// What the Comments tab lists
export type ThreadFilter = "open" | "resolved";

export const filterThreads = (
  threads: readonly CommentThread[],
  filter: ThreadFilter
): CommentThread[] =>
  threads.filter((thread) => isResolved(thread) === (filter === "resolved"));

export const threadCounts = (
  threads: readonly CommentThread[]
): Record<ThreadFilter, number> => {
  const resolved = threads.filter(isResolved).length;
  return { open: threads.length - resolved, resolved };
};

// The thread a comment is in (its root's id), so a link to a reply opens
// its thread. Null when there's no such comment.
export const threadIdOf = (
  comments: readonly DesignComment[],
  commentId: string
): string | null => {
  const comment = comments.find((item) => item.id === commentId);
  return comment ? (comment.threadId ?? comment.id) : null;
};

// Whether a thread's pin is on a page. A null page id is the first page,
// whose id is the design's own (plan 10).
export const isOnPage = (
  root: Pick<DesignComment, "pageId">,
  pageId: string,
  firstPageId: string
): boolean => (root.pageId ?? firstPageId) === pageId;
