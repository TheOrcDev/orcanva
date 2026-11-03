"use client";

import { RiAddLine, RiChat3Line } from "@remixicon/react";
import { useMemo, useState } from "react";

import {
  CommentAvatar,
  CommentBody,
} from "@/components/editor/comments/comment-body";
import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { PanelSection } from "@/components/editor/panels/panel-section";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { canComment } from "@/lib/auth/access";
import { anchorFor, elementSpot } from "@/lib/comments/anchor";
import {
  filterThreads,
  groupThreads,
  isResolved,
  threadCounts,
} from "@/lib/comments/threads";
import type { CommentThread, ThreadFilter } from "@/lib/comments/threads";
import { findElement } from "@/lib/editor/document-ops";
import { selectDocument } from "@/lib/editor/store";
import type { EditorStoreApi } from "@/lib/editor/store";
import { cn } from "@/lib/utils";
import { formatVersionTime } from "@/lib/versions/labels";

const FILTERS: { value: ThreadFilter; label: string }[] = [
  { label: "Open", value: "open" },
  { label: "Resolved", value: "resolved" },
];

const EMPTY: Record<ThreadFilter, { title: string; description: string }> = {
  open: {
    description: "Press C, then click the page where a comment belongs.",
    title: "No open comments",
  },
  resolved: {
    description: "Threads you resolve are kept here.",
    title: "Nothing resolved yet",
  },
};

// Starts a thread without a click on the canvas (keyboard and screen
// reader users): on the selected element, or in the middle of the page
const startThread = (store: EditorStoreApi) => {
  const state = store.getState();
  const document = selectDocument(state);
  const [id] = state.selectedIds;
  const element =
    state.selectedIds.length === 1 && id
      ? findElement(document, id)
      : undefined;
  const spot = element
    ? elementSpot(element)
    : { x: document.width / 2, y: document.height / 2 };
  state.placeDraft({
    anchor: element ? anchorFor(element, spot) : null,
    pageId: null,
    x: spot.x,
    y: spot.y,
  });
};

const ThreadItem = ({
  thread,
  open,
  now,
  onOpen,
}: {
  thread: CommentThread;
  open: boolean;
  now: Date;
  onOpen: () => void;
}) => {
  const replies = thread.replies.length;
  const { root } = thread;
  return (
    <li>
      <button
        type="button"
        aria-current={open ? "true" : undefined}
        onClick={onOpen}
        className={cn(
          "hover:bg-muted focus-visible:ring-ring flex w-full gap-2.5 rounded-2xl px-2.5 py-2 text-left transition-colors outline-none focus-visible:ring-2",
          open && "bg-muted"
        )}
      >
        <CommentAvatar comment={root} className="mt-0.5" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-baseline gap-1.5 text-sm">
            <span className="truncate font-medium">{root.authorName}</span>
            <time
              dateTime={root.createdAt}
              className="text-muted-foreground shrink-0 text-xs"
            >
              {formatVersionTime(new Date(root.createdAt), now)}
            </time>
          </span>
          <CommentBody comment={root} className="line-clamp-3" />
          {replies > 0 || isResolved(thread) ? (
            <span className="text-muted-foreground text-xs">
              {[
                replies > 0
                  ? `${replies} ${replies === 1 ? "reply" : "replies"}`
                  : null,
                isResolved(thread) ? "Resolved" : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          ) : null}
        </span>
      </button>
    </li>
  );
};

// The Comments tab: open or resolved threads, newest first. Picking one
// opens it on the canvas and brings its pin into view.
export const CommentsPanel = () => {
  const store = useEditorStoreApi();
  const comments = useEditor((state) => state.comments);
  const openThreadId = useEditor((state) => state.openThreadId);
  const allowed = useEditor((state) =>
    canComment(state.role, state.viewer?.id ?? null)
  );
  const [filter, setFilter] = useState<ThreadFilter>("open");
  // Times read relative to when the tab was opened; never replaced
  // oxlint-disable-next-line react/hook-use-state
  const [now] = useState(() => new Date());

  const threads = useMemo(() => groupThreads(comments), [comments]);
  const counts = threadCounts(threads);
  const shown = filterThreads(threads, filter);

  return (
    <PanelSection
      title="Comments"
      action={
        allowed ? (
          <Button
            variant="secondary"
            size="xs"
            onClick={() => startThread(store)}
          >
            <RiAddLine data-icon="inline-start" />
            New
          </Button>
        ) : null
      }
    >
      <ToggleGroup
        variant="outline"
        size="sm"
        aria-label="Which comments"
        value={[filter]}
        onValueChange={(value) => {
          // Pressing the current one again unpresses it: keep it
          const next = FILTERS.find((item) => item.value === value[0]);
          if (next) {
            setFilter(next.value);
          }
        }}
      >
        {FILTERS.map((item) => (
          <ToggleGroupItem key={item.value} value={item.value}>
            {item.label}
            <span className="text-muted-foreground tabular-nums">
              {counts[item.value]}
            </span>
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {shown.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <RiChat3Line />
            </EmptyMedia>
            <EmptyTitle>{EMPTY[filter].title}</EmptyTitle>
            <EmptyDescription>{EMPTY[filter].description}</EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ul
          className="-mx-2.5 flex flex-col gap-0.5"
          aria-label={`${filter === "open" ? "Open" : "Resolved"} comments`}
        >
          {shown.map((thread) => (
            <ThreadItem
              key={thread.root.id}
              thread={thread}
              open={thread.root.id === openThreadId}
              now={now}
              onOpen={() => store.getState().focusThread(thread.root.id)}
            />
          ))}
        </ul>
      )}
    </PanelSection>
  );
};

// The number of open threads, on the tab
export const OpenCommentCount = () => {
  const comments = useEditor((state) => state.comments);
  const open = useMemo(
    () =>
      comments.filter(
        (comment) => comment.threadId === null && comment.resolvedAt === null
      ).length,
    [comments]
  );
  return open > 0 ? (
    <span
      aria-hidden
      className="bg-primary text-primary-foreground absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-xs leading-none font-semibold tabular-nums"
    >
      {open}
    </span>
  ) : null;
};
