"use client";

import { useId, useState } from "react";
import type { KeyboardEvent } from "react";

import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  MAX_PROFILE_NAME,
  PROFILE_COLORS,
  initials,
  isLightColor,
} from "@/lib/collab/identity";
import { cn } from "@/lib/utils";

const MAX_SHOWN = 4;

const Initials = ({ name, color }: { name: string; color: string }) => (
  <span
    aria-hidden
    className={cn(
      "ring-background flex size-7 items-center justify-center rounded-full bg-(--peer-color) text-xs font-semibold ring-2",
      isLightColor(color) ? "text-black" : "text-white"
    )}
    style={{ "--peer-color": color }}
  >
    {initials(name)}
  </span>
);

// Your own avatar: change the name and color others see
const ProfileEditor = () => {
  const store = useEditorStoreApi();
  const profile = useEditor((state) => state.profile);
  const [draft, setDraft] = useState<string | null>(null);
  const id = useId();

  const commit = () => {
    const name = draft?.trim().slice(0, MAX_PROFILE_NAME);
    setDraft(null);
    if (name && name !== profile.name) {
      store.getState().setProfile({ ...profile, name });
    }
  };
  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      commit();
    }
  };

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={`You (${profile.name}): change your name and color`}
          />
        }
      >
        <Initials name={profile.name} color={profile.color} />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <PopoverHeader>
          <PopoverTitle>How others see you</PopoverTitle>
          <PopoverDescription>
            Your cursor and avatar on this design.
          </PopoverDescription>
        </PopoverHeader>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
            <Input
              id={`${id}-name`}
              maxLength={MAX_PROFILE_NAME}
              value={draft ?? profile.name}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={commit}
              onKeyDown={handleKeyDown}
            />
          </Field>
          <Field>
            <FieldLabel>Color</FieldLabel>
            <div className="grid grid-cols-8 gap-2">
              {PROFILE_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  aria-label={`Use ${color}`}
                  aria-pressed={color === profile.color}
                  className="ring-foreground/15 hover:ring-ring aria-pressed:ring-ring aspect-square rounded-full bg-(--swatch) ring-1 transition-shadow hover:ring-2 aria-pressed:ring-2"
                  style={{ "--swatch": color }}
                  onClick={() =>
                    store.getState().setProfile({ ...profile, color })
                  }
                />
              ))}
            </div>
          </Field>
        </FieldGroup>
      </PopoverContent>
    </Popover>
  );
};

// Who else is on this design right now, plus your own avatar
export const PresenceAvatars = () => {
  const peers = useEditor((state) => state.peers);
  const live = useEditor((state) => state.liveStatus !== "off");

  if (!live) {
    return null;
  }

  const shown = peers.slice(0, MAX_SHOWN);
  const hidden = peers.length - shown.length;

  return (
    <div className="flex items-center gap-1">
      <div className="flex items-center -space-x-1.5">
        {shown.map((peer) => (
          <Tooltip key={peer.clientId}>
            <TooltipTrigger render={<span />}>
              <Initials name={peer.name} color={peer.color} />
            </TooltipTrigger>
            <TooltipContent>{peer.name} is here</TooltipContent>
          </Tooltip>
        ))}
        {hidden > 0 ? (
          <span className="bg-muted text-muted-foreground ring-background flex size-7 items-center justify-center rounded-full text-xs font-semibold ring-2">
            +{hidden}
          </span>
        ) : null}
      </div>
      <ProfileEditor />
    </div>
  );
};
