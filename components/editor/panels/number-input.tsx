"use client";

import { useState } from "react";
import type { KeyboardEvent } from "react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@/components/ui/input-group";

export interface NumberInputProps {
  label: string;
  value: number;
  onCommit: (value: number) => void;
  min?: number;
  max?: number;
  precision?: number;
  suffix?: string;
  disabled?: boolean;
}

const round = (value: number, precision: number) => {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
};

// Edits stay local until blur/Enter, so each edit is one undo step
export const NumberInput = ({
  label,
  value,
  onCommit,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
  precision = 0,
  suffix,
  disabled,
}: NumberInputProps) => {
  const [draft, setDraft] = useState<string | null>(null);
  const display = draft ?? String(round(value, precision));

  const commit = () => {
    if (draft === null) {
      return;
    }
    const parsed = Number(draft);
    setDraft(null);
    if (draft.trim() === "" || !Number.isFinite(parsed)) {
      return;
    }
    const next = Math.min(max, Math.max(min, round(parsed, precision)));
    if (next !== round(value, precision)) {
      onCommit(next);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      commit();
      event.currentTarget.blur();
    }
    if (event.key === "Escape") {
      setDraft(null);
      event.currentTarget.blur();
    }
  };

  return (
    <InputGroup>
      <InputGroupAddon>
        <InputGroupText>{label}</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        aria-label={label}
        inputMode="decimal"
        value={display}
        disabled={disabled}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
      />
      {suffix ? (
        <InputGroupAddon align="inline-end">
          <InputGroupText>{suffix}</InputGroupText>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  );
};
