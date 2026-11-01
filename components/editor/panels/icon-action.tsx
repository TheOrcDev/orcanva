"use client";

import type { RemixiconComponentType } from "@remixicon/react";

import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// A small outlined icon button with its label as a tooltip
export const IconAction = ({
  label,
  icon: Icon,
  onClick,
  disabled,
}: {
  label: string;
  icon: RemixiconComponentType;
  onClick: () => void;
  disabled?: boolean;
}) => (
  <Tooltip>
    <TooltipTrigger
      render={
        <Button
          variant="outline"
          size="icon-sm"
          aria-label={label}
          disabled={disabled}
          onClick={onClick}
        />
      }
    >
      <Icon />
    </TooltipTrigger>
    <TooltipContent>{label}</TooltipContent>
  </Tooltip>
);
