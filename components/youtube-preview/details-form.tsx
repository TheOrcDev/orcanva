"use client";

import { RiDeleteBinLine, RiImageAddLine } from "@remixicon/react";
import { useId, useRef, useState, useTransition } from "react";
import type { ChangeEvent } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { initials } from "@/lib/collab/identity";
import { UploadError } from "@/lib/upload/prepare-image";
import { channelAvatar } from "@/lib/youtube-preview/avatar";
import {
  MAX_CHANNEL,
  MAX_TITLE,
  clampTitle,
  normalizeDuration,
} from "@/lib/youtube-preview/details";
import type { PreviewDetails } from "@/lib/youtube-preview/details";

// The length on the badge, typed freely and kept once it reads as one
const DurationField = ({
  duration,
  onDurationChange,
}: {
  duration: string;
  onDurationChange: (duration: string) => void;
}) => {
  const id = useId();
  const [draft, setDraft] = useState(duration);
  const [touched, setTouched] = useState(false);
  const normal = normalizeDuration(draft);
  const invalid = touched && normal === null;

  return (
    <Field data-invalid={invalid || undefined}>
      <FieldLabel htmlFor={id}>Length</FieldLabel>
      <Input
        id={id}
        value={draft}
        inputMode="numeric"
        aria-invalid={invalid || undefined}
        onChange={(event) => {
          const next = event.target.value;
          setDraft(next);
          const read = normalizeDuration(next);
          if (read) {
            onDurationChange(read);
          }
        }}
        onBlur={() => {
          setTouched(true);
          if (normal) {
            setDraft(normal);
          }
        }}
      />
      {invalid ? (
        <FieldError>Write it as minutes and seconds, like 12:34.</FieldError>
      ) : (
        <FieldDescription>Shown on the badge in the corner.</FieldDescription>
      )}
    </Field>
  );
};

// The channel's picture: one chosen here (cropped in the browser, never
// uploaded), or else the account's, or else initials
const AvatarField = ({
  avatar,
  channel,
  chosen,
  onChosenChange,
}: {
  // What the mock shows
  avatar: string | null;
  channel: string;
  // The picture picked here, if any
  chosen: string | null;
  onChosenChange: (avatar: string | null) => void;
}) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReading, startReading] = useTransition();

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    // Let the same file be picked again
    event.currentTarget.value = "";
    if (!file) {
      return;
    }
    startReading(async () => {
      try {
        onChosenChange(await channelAvatar(file));
        setError(null);
      } catch (error_) {
        setError(
          error_ instanceof UploadError
            ? error_.message
            : "Couldn't read that image"
        );
      }
    });
  };

  return (
    <Field data-invalid={error ? true : undefined}>
      <FieldTitle>Channel picture</FieldTitle>
      <div className="flex flex-wrap items-center gap-2">
        <Avatar size="lg">
          {avatar ? <AvatarImage src={avatar} alt="" /> : null}
          <AvatarFallback>{initials(channel)}</AvatarFallback>
        </Avatar>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          aria-label="Choose a channel picture"
          hidden
          onChange={handleFile}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={isReading}
          onClick={() => inputRef.current?.click()}
        >
          {isReading ? (
            <Spinner data-icon="inline-start" />
          ) : (
            <RiImageAddLine data-icon="inline-start" />
          )}
          Choose
        </Button>
        {chosen ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onChosenChange(null)}
          >
            <RiDeleteBinLine data-icon="inline-start" />
            Remove
          </Button>
        ) : null}
      </div>
      {error ? (
        <FieldError>{error}</FieldError>
      ) : (
        <FieldDescription>
          Cropped to a square and kept in this browser.
        </FieldDescription>
      )}
    </Field>
  );
};

// What the mock shows around the thumbnail. Store-free: the editor and the
// free preview page each keep the values and pass them in.
export const DetailsForm = ({
  avatar,
  channel,
  channelPlaceholder,
  details,
  onDetailsChange,
  onTitleChange,
  title,
  titlePlaceholder,
}: {
  // The picture and name the mock shows, after the fallbacks
  avatar: string | null;
  channel: string;
  // Shown when the channel is left empty
  channelPlaceholder: string;
  details: PreviewDetails;
  onDetailsChange: (details: PreviewDetails) => void;
  onTitleChange: (title: string) => void;
  title: string;
  // Shown when the title is left empty
  titlePlaceholder: string;
}) => {
  const id = useId();

  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor={`${id}-title`}>Title</FieldLabel>
        <Input
          id={`${id}-title`}
          value={title}
          placeholder={titlePlaceholder}
          maxLength={MAX_TITLE}
          onChange={(event) => onTitleChange(clampTitle(event.target.value))}
        />
        <FieldDescription>
          <span className="tabular-nums">
            {title.length}/{MAX_TITLE}
          </span>
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor={`${id}-channel`}>Channel</FieldLabel>
        <Input
          id={`${id}-channel`}
          value={details.channel}
          placeholder={channelPlaceholder}
          maxLength={MAX_CHANNEL}
          onChange={(event) =>
            onDetailsChange({ ...details, channel: event.target.value })
          }
        />
      </Field>
      <AvatarField
        avatar={avatar}
        channel={channel}
        chosen={details.avatar}
        onChosenChange={(next) => onDetailsChange({ ...details, avatar: next })}
      />
      <DurationField
        duration={details.duration}
        onDurationChange={(duration) =>
          onDetailsChange({ ...details, duration })
        }
      />
    </FieldGroup>
  );
};
