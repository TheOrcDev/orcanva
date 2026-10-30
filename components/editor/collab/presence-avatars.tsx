"use client";

import Image from "next/image";
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
import { toast } from "@/components/ui/toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { authClient, authErrorMessage } from "@/lib/auth/client";
import type { Profile } from "@/lib/collab/identity";
import {
  MAX_PROFILE_NAME,
  PROFILE_COLORS,
  initials,
  isLightColor,
} from "@/lib/collab/identity";
import type { EditorStoreApi } from "@/lib/editor/store";
import { cn } from "@/lib/utils";

const MAX_SHOWN = 4;

// An account picture when the person has one, otherwise their initials
const Initials = ({
  name,
  color,
  image,
}: {
  name: string;
  color: string;
  image: string | null;
}) => (
  <span
    aria-hidden
    className={cn(
      "ring-background relative flex size-7 items-center justify-center overflow-hidden rounded-full bg-(--peer-color) text-xs font-semibold ring-2",
      isLightColor(color) ? "text-black" : "text-white"
    )}
    style={{ "--peer-color": color }}
  >
    {image ? (
      <Image
        src={image}
        alt=""
        fill
        unoptimized
        sizes="28px"
        referrerPolicy="no-referrer"
        className="object-cover"
      />
    ) : (
      initials(name)
    )}
  </span>
);

// Changes the account's name; on failure puts the old one back and says so
const renameAccount = async (
  store: EditorStoreApi,
  name: string,
  previous: Profile
) => {
  try {
    const { error } = await authClient.updateUser({ name });
    if (error) {
      throw error;
    }
  } catch (error) {
    store.getState().setProfile(previous);
    toast.add({
      description: authErrorMessage(error, "Try again in a moment."),
      title: "Couldn't change your name",
      type: "error",
    });
  }
};

// Your own avatar: change the name and color others see
const ProfileEditor = () => {
  const store = useEditorStoreApi();
  const profile = useEditor((state) => state.profile);
  const viewer = useEditor((state) => state.viewer);
  const [draft, setDraft] = useState<string | null>(null);
  const id = useId();

  const commit = () => {
    const name = draft?.trim().slice(0, MAX_PROFILE_NAME);
    setDraft(null);
    if (!name || name === profile.name) {
      return;
    }
    const previous = profile;
    store.getState().setProfile({ ...profile, name });
    // Signed in, the name is the account's: change it everywhere
    if (viewer) {
      renameAccount(store, name, previous).catch(() => null);
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
        <Initials
          name={profile.name}
          color={profile.color}
          image={viewer?.image ?? null}
        />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72">
        <PopoverHeader>
          <PopoverTitle>How others see you</PopoverTitle>
          <PopoverDescription>
            {viewer
              ? "Your cursor and avatar on shared designs. The name is your account's."
              : "Your cursor and avatar on this design."}
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
              <Initials
                name={peer.name}
                color={peer.color}
                image={peer.image}
              />
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
