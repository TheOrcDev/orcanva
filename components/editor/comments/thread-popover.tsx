"use client";

import {
  RiCheckboxCircleLine,
  RiDeleteBinLine,
  RiMore2Line,
  RiPencilLine,
  RiRefreshLine,
} from "@remixicon/react";
import Link from "next/link";
import { useState } from "react";
import type { RefObject } from "react";

import {
  CommentAvatar,
  CommentBody,
} from "@/components/editor/comments/comment-body";
import { Composer } from "@/components/editor/comments/composer";
import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PopoverDescription, PopoverTitle } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  canComment,
  canDeleteComment,
  canEditComment,
  canResolveThread,
} from "@/lib/auth/access";
import { signInUrl } from "@/lib/auth/redirect";
import type { PinState } from "@/lib/comments/anchor";
import { deleteComment, patchComment, postComment } from "@/lib/comments/api";
import { decodeMentions } from "@/lib/comments/body";
import type { CommentPin, DesignComment } from "@/lib/comments/schema";
import { isResolved } from "@/lib/comments/threads";
import type { CommentThread } from "@/lib/comments/threads";
import { formatVersionTime } from "@/lib/versions/labels";

const designPath = (designId: string) => `/design/${designId}`;

// Posting needs an account; guests read along
const useCanComment = (): boolean =>
  useEditor((state) => canComment(state.role, state.viewer?.id ?? null));

const SignInToComment = ({ reply }: { reply: boolean }) => {
  const designId = useEditor((state) => state.designId);
  return (
    <div className="flex flex-col items-start gap-2">
      <p className="text-muted-foreground text-sm">
        {reply
          ? "Sign in to reply to this comment."
          : "Sign in to leave a comment."}
      </p>
      <Link
        href={signInUrl(designPath(designId))}
        className={buttonVariants({ size: "sm" })}
      >
        Sign in to comment
      </Link>
    </div>
  );
};

// Says why a request failed; resolves false so a composer keeps its text
const reportFailure = (title: string, error: unknown): false => {
  toast.add({
    description: error instanceof Error ? error.message : undefined,
    title,
    type: "error",
  });
  return false;
};

// Asks before deleting, in place
const ConfirmDelete = ({
  thread,
  onCancel,
  onDelete,
}: {
  thread: boolean;
  onCancel: () => void;
  onDelete: () => Promise<void>;
}) => {
  const [deleting, setDeleting] = useState(false);
  return (
    <div className="bg-muted flex flex-col gap-2 rounded-2xl p-3">
      <p className="text-sm">
        {thread ? "Delete this comment and its replies?" : "Delete this reply?"}
      </p>
      <div className="flex justify-end gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={deleting}
          onClick={onCancel}
        >
          Cancel
        </Button>
        <Button
          variant="destructive"
          size="sm"
          disabled={deleting}
          onClick={async () => {
            setDeleting(true);
            await onDelete();
            setDeleting(false);
          }}
        >
          {deleting ? <Spinner data-icon="inline-start" /> : null}
          Delete
        </Button>
      </div>
    </div>
  );
};

const CommentActions = ({
  label,
  onEdit,
  onDelete,
}: {
  label: string;
  onEdit: (() => void) | null;
  onDelete: (() => void) | null;
}) => (
  <DropdownMenu>
    <DropdownMenuTrigger
      render={<Button variant="ghost" size="icon-xs" aria-label={label} />}
    >
      <RiMore2Line />
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuGroup>
        {onEdit ? (
          <DropdownMenuItem onClick={onEdit}>
            <RiPencilLine />
            Edit
          </DropdownMenuItem>
        ) : null}
        {onDelete ? (
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <RiDeleteBinLine />
            Delete
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuGroup>
    </DropdownMenuContent>
  </DropdownMenu>
);

const CommentItem = ({
  comment,
  now,
}: {
  comment: DesignComment;
  now: Date;
}) => {
  const store = useEditorStoreApi();
  // Its author changes it; its author or the design's owner deletes it
  const mayEdit = useEditor((state) =>
    canEditComment(state.viewer?.id ?? null, comment.authorId)
  );
  const mayDelete = useEditor((state) =>
    canDeleteComment(state.role, state.viewer?.id ?? null, comment.authorId)
  );
  const [mode, setMode] = useState<"read" | "edit" | "delete">("read");
  const isThread = comment.threadId === null;

  const save = async (body: string): Promise<boolean> => {
    try {
      const { designId, upsertComment } = store.getState();
      upsertComment(await patchComment(designId, comment.id, { body }));
      setMode("read");
      return true;
    } catch (error) {
      return reportFailure("Couldn't save the comment", error);
    }
  };

  const remove = async () => {
    try {
      const { designId, removeComment } = store.getState();
      await deleteComment(designId, comment.id);
      removeComment(comment.id);
    } catch (error) {
      reportFailure("Couldn't delete the comment", error);
      setMode("read");
    }
  };

  return (
    <li className="flex gap-2.5">
      <CommentAvatar comment={comment} className="mt-0.5" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-1.5">
          <p className="flex min-w-0 flex-1 items-baseline gap-1.5 text-sm">
            <span className="truncate font-medium">{comment.authorName}</span>
            <time
              dateTime={comment.createdAt}
              className="text-muted-foreground shrink-0 text-xs"
            >
              {formatVersionTime(new Date(comment.createdAt), now)}
            </time>
            {comment.editedAt ? (
              <span className="text-muted-foreground text-xs">(edited)</span>
            ) : null}
          </p>
          {(mayEdit || mayDelete) && mode === "read" ? (
            <CommentActions
              label={`Actions for ${comment.authorName}'s ${isThread ? "comment" : "reply"}`}
              onEdit={mayEdit ? () => setMode("edit") : null}
              onDelete={mayDelete ? () => setMode("delete") : null}
            />
          ) : null}
        </div>
        {mode === "edit" ? (
          <Composer
            label="Edit comment"
            placeholder="Comment"
            submitLabel="Save"
            initial={decodeMentions(comment.body, comment.mentions)}
            autoFocus
            onSubmit={save}
            onCancel={() => setMode("read")}
          />
        ) : (
          <CommentBody comment={comment} />
        )}
        {mode === "delete" ? (
          <ConfirmDelete
            thread={isThread}
            onCancel={() => setMode("read")}
            onDelete={remove}
          />
        ) : null}
      </div>
    </li>
  );
};

// Resolve or reopen, for the owner, members and whoever started it
const ResolveButton = ({ thread }: { thread: CommentThread }) => {
  const store = useEditorStoreApi();
  const allowed = useEditor((state) =>
    canResolveThread(state.role, state.viewer?.id ?? null, thread.root.authorId)
  );
  const [busy, setBusy] = useState(false);
  if (!allowed) {
    return null;
  }
  const resolved = isResolved(thread);
  const label = resolved ? "Reopen" : "Resolve";

  const toggle = async () => {
    setBusy(true);
    try {
      const { designId, upsertComment } = store.getState();
      upsertComment(
        await patchComment(designId, thread.root.id, { resolved: !resolved })
      );
    } catch (error) {
      reportFailure(`Couldn't ${label.toLowerCase()} the thread`, error);
    }
    setBusy(false);
  };

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            disabled={busy}
            onClick={toggle}
          />
        }
      >
        {resolved ? <RiRefreshLine /> : <RiCheckboxCircleLine />}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
};

// An open thread: its comments, oldest first, and a box to reply
export const ThreadView = ({
  thread,
  state,
  textareaRef,
}: {
  thread: CommentThread;
  state: PinState;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}) => {
  const store = useEditorStoreApi();
  const allowed = useCanComment();
  // Times read relative to when the thread was opened; never replaced
  // oxlint-disable-next-line react/hook-use-state
  const [now] = useState(() => new Date());

  const reply = async (body: string): Promise<boolean> => {
    try {
      const { designId, upsertComment } = store.getState();
      upsertComment(
        await postComment(designId, { body, threadId: thread.root.id })
      );
      return true;
    } catch (error) {
      return reportFailure("Couldn't send the reply", error);
    }
  };

  return (
    <>
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <PopoverTitle>Comment by {thread.root.authorName}</PopoverTitle>
          {state === "detached" ? (
            <PopoverDescription>
              The element it was on is gone, so it stays where it was put.
            </PopoverDescription>
          ) : null}
        </div>
        {isResolved(thread) ? (
          <Badge variant="secondary">Resolved</Badge>
        ) : null}
        <ResolveButton thread={thread} />
      </div>
      <ol className="-mx-4 flex max-h-80 flex-col gap-4 overflow-y-auto px-4">
        {[thread.root, ...thread.replies].map((comment) => (
          <CommentItem key={comment.id} comment={comment} now={now} />
        ))}
      </ol>
      {allowed ? (
        <Composer
          label="Reply"
          placeholder="Reply"
          submitLabel="Reply"
          textareaRef={textareaRef}
          onSubmit={reply}
        />
      ) : (
        <SignInToComment reply />
      )}
    </>
  );
};

// A new thread being written where its pin was put
export const NewThreadView = ({
  pin,
  textareaRef,
}: {
  pin: CommentPin;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}) => {
  const store = useEditorStoreApi();
  const allowed = useCanComment();

  const post = async (body: string): Promise<boolean> => {
    try {
      const { designId, openThread, upsertComment } = store.getState();
      const comment = await postComment(designId, { body, pin });
      upsertComment(comment);
      openThread(comment.id);
      return true;
    } catch (error) {
      return reportFailure("Couldn't add the comment", error);
    }
  };

  return (
    <>
      <PopoverTitle>New comment</PopoverTitle>
      {allowed ? (
        <Composer
          label="Comment"
          placeholder={
            pin.anchor
              ? "Comment on this element"
              : "Comment on this part of the page"
          }
          submitLabel="Comment"
          textareaRef={textareaRef}
          onSubmit={post}
          onCancel={() => store.getState().placeDraft(null)}
        />
      ) : (
        <SignInToComment reply={false} />
      )}
    </>
  );
};
