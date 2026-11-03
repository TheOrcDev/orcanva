"use client";

import { useId, useRef, useState } from "react";
import type {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  RefObject,
  SyntheticEvent,
} from "react";
import { flushSync } from "react-dom";

import { CommentAvatar } from "@/components/editor/comments/comment-body";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useMentionable } from "@/hooks/use-mentionable";
import {
  encodeMentions,
  insertMention,
  matchPeople,
  mentionQueryAt,
} from "@/lib/comments/body";
import type { ComposerMention } from "@/lib/comments/body";
import { MAX_COMMENT_LENGTH } from "@/lib/comments/limits";
import type { MentionPerson } from "@/lib/comments/schema";
import { cn } from "@/lib/utils";

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

// The "@…" being typed and where it is
interface MentionQuery {
  start: number;
  end: number;
  text: string;
}

const queryAt = (field: HTMLTextAreaElement): MentionQuery | null => {
  if (field.selectionStart !== field.selectionEnd) {
    return null;
  }
  const found = mentionQueryAt(field.value, field.selectionStart);
  return found
    ? { end: field.selectionStart, start: found.start, text: found.query }
    : null;
};

const MentionList = ({
  id,
  people,
  highlight,
  onPick,
}: {
  id: string;
  people: readonly MentionPerson[];
  highlight: number;
  onPick: (person: MentionPerson) => void;
}) => (
  <div
    id={id}
    // The ARIA combobox pattern: no HTML element suggests for a textarea
    // (datalist only works with inputs)
    // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
    role="listbox"
    aria-label="People to mention"
    className="bg-popover ring-foreground/10 flex flex-col gap-0.5 rounded-2xl p-1 shadow-md ring-1"
  >
    {people.map((person, index) => (
      // The text box keeps focus and handles the keys; a click picks too
      // oxlint-disable-next-line jsx-a11y/click-events-have-key-events
      <div
        key={person.id}
        id={`${id}-${person.id}`}
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role
        role="option"
        tabIndex={-1}
        aria-selected={index === highlight}
        className={cn(
          "flex cursor-default items-center gap-2 rounded-xl px-2 py-1.5 text-sm",
          index === highlight && "bg-muted"
        )}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onPick(person)}
      >
        <CommentAvatar
          comment={{ authorImage: person.image, authorName: person.name }}
        />
        <span className="truncate">{person.name}</span>
      </div>
    ))}
  </div>
);

// The text box as an ARIA combobox while it offers people to mention
const comboboxProps = (
  offers: boolean,
  listId: string,
  active: MentionPerson | undefined
) =>
  offers
    ? {
        "aria-activedescendant": active ? `${listId}-${active.id}` : undefined,
        "aria-autocomplete": "list" as const,
        "aria-controls": active ? listId : undefined,
        "aria-expanded": active !== undefined,
        role: "combobox",
      }
    : {};

// Where a comment or reply is written. Enter sends it, Shift+Enter starts a
// new line. Typing "@" offers the design's owner and the people it's shared
// with (to those who may mention); a picked name becomes a mention.
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
  const listId = `${id}-people`;
  const ownRef = useRef<HTMLTextAreaElement>(null);
  const fieldRef = textareaRef ?? ownRef;
  const people = useMentionable();
  const offersMentions = people.length > 0;
  const [text, setText] = useState(initial?.text ?? "");
  // People picked for "@Name"s in the text
  const [mentions, setMentions] = useState<ComposerMention[]>(
    initial?.mentions ?? []
  );
  const [query, setQuery] = useState<MentionQuery | null>(null);
  const [highlight, setHighlight] = useState(0);
  // Esc closes the list until another "@" starts
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const empty = text.trim() === "";

  const matches =
    query && query.start !== dismissedAt ? matchPeople(people, query.text) : [];
  const listOpen = matches.length > 0;
  const highlighted = Math.min(highlight, matches.length - 1);
  const active = listOpen ? matches[highlighted] : undefined;

  const track = (field: HTMLTextAreaElement) => {
    const next = queryAt(field);
    setQuery(next);
    if (next?.start !== query?.start) {
      setHighlight(0);
    }
  };

  const pick = (person: MentionPerson) => {
    if (!query) {
      return;
    }
    const inserted = insertMention(text, query, person.name);
    // The text must be in the box before the caret can go after the name
    flushSync(() => {
      setText(inserted.text);
      setQuery(null);
    });
    fieldRef.current?.setSelectionRange(inserted.caret, inserted.caret);
    setMentions((current) => [
      ...current.filter((mention) => mention.id !== person.id),
      { id: person.id, name: person.name },
    ]);
  };

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
      setQuery(null);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    submit().catch(() => null);
  };

  // Keys for the open list; true when it used the key
  const handleListKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    const count = matches.length;
    switch (event.key) {
      case "ArrowDown": {
        setHighlight((highlighted + 1) % count);
        return true;
      }
      case "ArrowUp": {
        setHighlight((highlighted - 1 + count) % count);
        return true;
      }
      case "Enter":
      case "Tab": {
        if (active) {
          pick(active);
        }
        return true;
      }
      case "Escape": {
        // Closes the list, not the thread around it
        event.stopPropagation();
        setDismissedAt(query?.start ?? null);
        return true;
      }
      default: {
        return false;
      }
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) {
      return;
    }
    if (listOpen && handleListKey(event)) {
      event.preventDefault();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit().catch(() => null);
    }
  };

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setText(event.target.value);
    track(event.target);
  };

  return (
    <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      <Textarea
        ref={fieldRef}
        id={id}
        value={text}
        placeholder={
          offersMentions ? `${placeholder} (@ to mention)` : placeholder
        }
        maxLength={MAX_COMMENT_LENGTH}
        // Read-only rather than disabled while it sends, so it keeps focus
        readOnly={sending}
        // Only when the person asked for it (Edit), never on page load
        // oxlint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
        {...comboboxProps(offersMentions, listId, active)}
        className="max-h-40"
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onSelect={(event: SyntheticEvent<HTMLTextAreaElement>) =>
          track(event.currentTarget)
        }
        onBlur={() => setQuery(null)}
      />
      {listOpen ? (
        <MentionList
          id={listId}
          people={matches}
          highlight={highlighted}
          onPick={pick}
        />
      ) : null}
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
