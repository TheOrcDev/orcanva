"use client";

import { RiFileLine } from "@remixicon/react";
import Image from "next/image";
import type { ReactNode } from "react";

import {
  Field,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { templatesForPreset } from "@/lib/templates/lookup";

const BLANK = "blank";

const Choice = ({
  id,
  value,
  title,
  children,
}: {
  id: string;
  value: string;
  title: string;
  children: ReactNode;
}) => (
  <div className="w-40 shrink-0">
    <FieldLabel htmlFor={id}>
      <Field>
        <div className="bg-muted relative flex aspect-video items-center justify-center overflow-hidden rounded-lg">
          {children}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium">{title}</span>
          <RadioGroupItem value={value} id={id} />
        </div>
      </Field>
    </FieldLabel>
  </div>
);

// "Blank" plus the templates made for a size, in a row that scrolls
// sideways; nothing when the size has none. `value` is a template id, or
// null for a blank design.
export const TemplatePicker = ({
  idPrefix,
  presetId,
  value,
  onValueChange,
}: {
  idPrefix: string;
  presetId: string | null;
  value: string | null;
  onValueChange: (templateId: string | null) => void;
}) => {
  const templates = templatesForPreset(presetId);
  if (templates.length === 0) {
    return null;
  }
  const chosen = templates.some((template) => template.id === value)
    ? value
    : null;

  return (
    <FieldSet className="min-w-0">
      <FieldLegend variant="label">Start from</FieldLegend>
      <div className="-mx-1 overflow-x-auto px-1 pb-2">
        <RadioGroup
          className="flex w-max"
          value={chosen ?? BLANK}
          onValueChange={(next) =>
            onValueChange(next === BLANK ? null : String(next))
          }
        >
          <Choice id={`${idPrefix}-blank`} value={BLANK} title="Blank">
            <RiFileLine className="text-muted-foreground" aria-hidden />
          </Choice>
          {templates.map((template) => (
            <Choice
              key={template.id}
              id={`${idPrefix}-template-${template.id}`}
              value={template.id}
              title={template.name}
            >
              <Image
                src={template.preview}
                alt=""
                fill
                unoptimized
                sizes="144px"
                className="object-contain"
              />
            </Choice>
          ))}
        </RadioGroup>
      </div>
    </FieldSet>
  );
};
