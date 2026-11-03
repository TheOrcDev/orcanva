"use client";

import { useId, useState } from "react";
import type { FormEvent, KeyboardEvent, RefObject } from "react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { encodeMentions } from "@/lib/comments/body";
import type { ComposerMention } from "@/lib/comments/body";
import { MAX_COMMENT_LENGTH } from "@/lib/comments/limits";

// Shows how much is left once a comment gets this close to the limit
const SHOW_COUNT_FROM = MAX_COMMENT_LENGTH - 200;

interface ComposerProps {
  // Names the text box for screen readers ("Comment", "Reply")
  label: string;
  placeholder: string;
  submitLabel: string;
  // A comment being edited: its text with "@Name"s, and who they are
  initial?: { text: string; mentions: ComposerMention[] };
  autoFocus?: boolean;
  // Sends the body (mentions as tokens); resolves true once it's stored,
  // so the box empties
  onSubmit: (body: string) => Promise<boolean>;
  onCancel?: () => void;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
}

// Where a comment or reply is written. Enter sends it, Shift+Enter starts a
// new line.
export const Composer = ({
  label,
  placeholder,
  submitLabel,
  initial,
  autoFocus = false,
  onSubmit,
  onCancel,
  textareaRef,
}: ComposerProps) => {
  const id = useId();
  const [text, setText] = useState(initial?.text ?? "");
  // People picked for "@Name"s in the text
  const [mentions, setMentions] = useState<ComposerMention[]>(
    initial?.mentions ?? []
  );
  const [sending, setSending] = useState(false);
  const empty = text.trim() === "";

  const submit = async () => {
    if (empty || sending) {
      return;
    }
    setSending(true);
    const sent = await onSubmit(encodeMentions(text, mentions));
    setSending(false);
    if (sent) {
      setText("");
      setMentions([]);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit().catch(() => null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      submit().catch(() => null);
    }
  };

  return (
    <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Textarea
        ref={textareaRef}
        id={id}
        // Only when the person asked for it (Edit), never on page load
        // oxlint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
        value={text}
        placeholder={placeholder}
        maxLength={MAX_COMMENT_LENGTH}
        // Read-only rather than disabled while it sends, so it keeps focus
        readOnly={sending}
        className="max-h-40"
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="flex items-center justify-end gap-2">
        {text.length >= SHOW_COUNT_FROM ? (
          <span className="text-muted-foreground mr-auto text-xs tabular-nums">
            {MAX_COMMENT_LENGTH - text.length} left
          </span>
        ) : null}
        {onCancel ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={sending}
            onClick={onCancel}
          >
            Cancel
          </Button>
        ) : null}
        <Button type="submit" size="sm" disabled={empty || sending}>
          {sending ? <Spinner data-icon="inline-start" /> : null}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
};
