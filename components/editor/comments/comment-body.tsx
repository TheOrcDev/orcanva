"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/collab/identity";
import { bodyParts } from "@/lib/comments/body";
import type { DesignComment } from "@/lib/comments/schema";
import { cn } from "@/lib/utils";

// The author's picture, or their initials. Decorative: their name is
// always written beside it (or in the pin's label).
export const CommentAvatar = ({
  comment,
  className,
}: {
  comment: Pick<DesignComment, "authorImage" | "authorName">;
  className?: string;
}) => (
  <Avatar size="sm" className={className} aria-hidden>
    {comment.authorImage ? (
      <AvatarImage
        src={comment.authorImage}
        alt=""
        referrerPolicy="no-referrer"
      />
    ) : null}
    <AvatarFallback>{initials(comment.authorName)}</AvatarFallback>
  </Avatar>
);

// A comment's text as written, line breaks kept, with mentions as names.
// Plain text nodes only: nothing in it is ever read as HTML or a link.
export const CommentBody = ({
  comment,
  className,
}: {
  comment: Pick<DesignComment, "body" | "mentions">;
  className?: string;
}) => (
  <p className={cn("text-sm break-words whitespace-pre-wrap", className)}>
    {bodyParts(comment.body, comment.mentions).map((part, index) =>
      part.kind === "text" ? (
        part.text
      ) : (
        // Parts never reorder, so their place identifies them
        // oxlint-disable-next-line react/no-array-index-key
        <span key={index} className="text-primary font-medium">
          @{part.name}
        </span>
      )
    )}
  </p>
);
