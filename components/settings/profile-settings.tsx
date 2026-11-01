"use client";

import { RiDeleteBinLine, RiUploadLine } from "@remixicon/react";
import { useId, useRef, useState, useTransition } from "react";
import type { ChangeEvent, FormEvent } from "react";

import { UserAvatar } from "@/components/auth/user-menu";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import { removeAvatar, updateAvatar, updateName } from "@/lib/actions/account";
import { MAX_PROFILE_NAME } from "@/lib/collab/identity";
import { prepareAvatar } from "@/lib/upload/prepare-avatar";
import { UploadError } from "@/lib/upload/prepare-image";

export interface ProfileSettingsViewer {
  name: string;
  email: string;
  image: string | null;
}

const AvatarCard = ({ viewer }: { viewer: ProfileSettingsViewer }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isUploading, startUpload] = useTransition();
  const [isRemoving, startRemove] = useTransition();
  const isPending = isUploading || isRemoving;

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    // Let the same file be picked again after a failure
    event.currentTarget.value = "";
    if (!file) {
      return;
    }
    startUpload(async () => {
      try {
        const data = new FormData();
        data.set("avatar", await prepareAvatar(file));
        await updateAvatar(data);
        toast.add({ title: "Avatar updated", type: "success" });
      } catch (error) {
        toast.add({
          title:
            error instanceof UploadError
              ? error.message
              : "Couldn't update your avatar",
          type: "error",
        });
      }
    });
  };

  const handleRemove = () => {
    startRemove(async () => {
      try {
        await removeAvatar();
        toast.add({ title: "Avatar removed", type: "success" });
      } catch {
        toast.add({ title: "Couldn't remove your avatar", type: "error" });
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Avatar</CardTitle>
        <CardDescription>
          Shown in your account menu and next to your cursor on shared designs.
          It&apos;s cropped to a square from the middle.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap items-center gap-4">
          <UserAvatar viewer={viewer} className="size-16" />
          <div className="flex flex-wrap gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleFile}
            />
            <Button
              variant="outline"
              disabled={isPending}
              onClick={() => inputRef.current?.click()}
            >
              {isUploading ? (
                <Spinner data-icon="inline-start" />
              ) : (
                <RiUploadLine data-icon="inline-start" />
              )}
              Upload image
            </Button>
            {viewer.image ? (
              <Button
                variant="ghost"
                disabled={isPending}
                onClick={handleRemove}
              >
                {isRemoving ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <RiDeleteBinLine data-icon="inline-start" />
                )}
                Remove
              </Button>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const ProfileCard = ({ viewer }: { viewer: ProfileSettingsViewer }) => {
  const id = useId();
  const [name, setName] = useState(viewer.name);
  const [isPending, startTransition] = useTransition();
  const trimmed = name.trim();
  const unchanged = trimmed === viewer.name;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!trimmed || unchanged) {
      return;
    }
    startTransition(async () => {
      try {
        await updateName(trimmed);
        setName(trimmed);
        toast.add({ title: "Name updated", type: "success" });
      } catch {
        toast.add({ title: "Couldn't update your name", type: "error" });
      }
    });
  };

  return (
    <Card>
      <form onSubmit={handleSubmit} className="contents">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>How you appear to others.</CardDescription>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
              <Input
                id={`${id}-name`}
                name="name"
                autoComplete="name"
                maxLength={MAX_PROFILE_NAME}
                required
                value={name}
                onChange={(event) => setName(event.currentTarget.value)}
              />
              <FieldDescription>
                Others see it on designs you edit together and on the public
                designs you own.
              </FieldDescription>
            </Field>
            <Field>
              <FieldLabel htmlFor={`${id}-email`}>Email</FieldLabel>
              <Input
                id={`${id}-email`}
                type="email"
                value={viewer.email}
                readOnly
                disabled
              />
              <FieldDescription>
                You sign in with it; it can&apos;t be changed.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </CardContent>
        <CardFooter className="justify-end">
          <Button type="submit" disabled={isPending || unchanged || !trimmed}>
            {isPending ? <Spinner data-icon="inline-start" /> : null}
            Save
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
};

// The signed-in person's name and picture. Each change is saved by a
// Server Action, which refreshes the page, so the header's avatar menu and
// these cards always show what's stored.
export const ProfileSettings = ({
  viewer,
}: {
  viewer: ProfileSettingsViewer;
}) => (
  <div className="flex flex-col gap-6">
    <AvatarCard viewer={viewer} />
    <ProfileCard viewer={viewer} />
  </div>
);
