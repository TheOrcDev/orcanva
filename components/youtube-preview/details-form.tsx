"use client";

import { useId, useState } from "react";

import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  MAX_CHANNEL,
  MAX_TITLE,
  PREVIEW_THEMES,
  clampTitle,
  normalizeDuration,
} from "@/lib/youtube-preview/details";
import type { PreviewDetails } from "@/lib/youtube-preview/details";

const THEME_LABELS = { dark: "Dark", light: "Light" } as const;

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

// What the mock shows around the thumbnail. Store-free: the editor and the
// free preview page each keep the values and pass them in.
export const DetailsForm = ({
  channelPlaceholder,
  details,
  onDetailsChange,
  onTitleChange,
  title,
  titlePlaceholder,
}: {
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
        <FieldLabel>Look</FieldLabel>
        <ToggleGroup
          aria-label="Look"
          variant="outline"
          value={[details.theme]}
          onValueChange={(value) => {
            const [next] = value;
            const theme = PREVIEW_THEMES.find((item) => item === next);
            if (theme) {
              onDetailsChange({ ...details, theme });
            }
          }}
        >
          {PREVIEW_THEMES.map((theme) => (
            <ToggleGroupItem key={theme} value={theme}>
              {THEME_LABELS[theme]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </Field>
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
      <DurationField
        duration={details.duration}
        onDurationChange={(duration) =>
          onDetailsChange({ ...details, duration })
        }
      />
    </FieldGroup>
  );
};
