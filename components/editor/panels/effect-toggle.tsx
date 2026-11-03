"use client";

import { useId } from "react";
import type { ReactNode } from "react";

import { PanelSection } from "@/components/editor/panels/panel-section";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

// A panel section an effect's switch turns on, showing its settings
export const EffectToggle = ({
  title,
  enabled,
  onToggle,
  children,
}: {
  title: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  children: ReactNode;
}) => {
  const id = useId();
  return (
    <PanelSection
      title={title}
      action={
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="sr-only">
            {title}
          </Label>
          <Switch id={id} checked={enabled} onCheckedChange={onToggle} />
        </div>
      }
    >
      {enabled ? children : null}
    </PanelSection>
  );
};
