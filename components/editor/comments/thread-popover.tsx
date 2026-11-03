"use client";

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
import { buttonVariants } from "@/components/ui/button";
import { PopoverDescription, PopoverTitle } from "@/components/ui/popover";
import { toast } from "@/components/ui/toast";
import { canComment } from "@/lib/auth/access";
import { signInUrl } from "@/lib/auth/redirect";
import type { PinState } from "@/lib/comments/anchor";
import { postComment } from "@/lib/comments/api";
import type { CommentPin, DesignComment } from "@/lib/comments/schema";
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
        {reply ? "Sign in to reply." : "Sign in to comment."}
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

const CommentItem = ({
  comment,
  now,
}: {
  comment: DesignComment;
  now: Date;
}) => (
  <li className="flex gap-2.5">
    <CommentAvatar comment={comment} className="mt-0.5" />
    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
      <p className="flex items-baseline gap-1.5 text-sm">
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
      <CommentBody comment={comment} />
    </div>
  </li>
);

// Shows why a post failed; resolves whether it went through
const reportFailure = (title: string, error: unknown): false => {
  toast.add({
    description: error instanceof Error ? error.message : undefined,
    title,
    type: "error",
  });
  return false;
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
      <div className="flex flex-col gap-1">
        <PopoverTitle>Comment by {thread.root.authorName}</PopoverTitle>
        {state === "detached" ? (
          <PopoverDescription>
            The element it was on is gone, so it stays where it was put.
          </PopoverDescription>
        ) : null}
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
