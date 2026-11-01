"use server";

import { refresh } from "next/cache";
import { z } from "zod";

import { forgetCachedSession, getAuth, getViewer } from "@/lib/auth/server";
import type { Viewer } from "@/lib/auth/server";
import { MAX_PROFILE_NAME } from "@/lib/collab/identity";
import { avatarKey, ownAvatarKey, storageUrl } from "@/lib/storage/keys";
import { deleteObject, putObject } from "@/lib/storage/s3";

// Avatars are 256px JPEGs from prepareAvatar; anything bigger isn't
const MAX_AVATAR_BYTES = 256 * 1024;
const JPEG_MAGIC = [0xff, 0xd8, 0xff];

// Server Actions are public endpoints: each one checks the session itself
const requireViewer = async (): Promise<Viewer> => {
  const viewer = await getViewer();
  if (!viewer) {
    throw new Error("Sign in first");
  }
  return viewer;
};

const updateUser = async (changes: {
  name?: string;
  image?: string | null;
}): Promise<void> => {
  const { error } = await getAuth().updateUser(changes);
  if (error) {
    throw new Error(`Couldn't update the profile: ${error.message}`);
  }
  await forgetCachedSession();
  refresh();
};

// The old picture goes once the new one is saved; a failure here only
// leaves an unreachable file behind
const deleteAvatar = async (viewer: Viewer): Promise<void> => {
  const key = ownAvatarKey(viewer.image, viewer.id);
  if (key) {
    await deleteObject(key).catch(() => null);
  }
};

const profileName = z.string().trim().min(1).max(MAX_PROFILE_NAME);

export const updateName = async (name: string): Promise<void> => {
  const parsed = profileName.parse(name);
  await requireViewer();
  await updateUser({ name: parsed });
};

export const updateAvatar = async (data: FormData): Promise<void> => {
  const viewer = await requireViewer();
  const file = data.get("avatar");
  if (
    !(file instanceof Blob) ||
    file.type !== "image/jpeg" ||
    file.size === 0 ||
    file.size > MAX_AVATAR_BYTES
  ) {
    throw new Error("Avatar must be a JPEG of at most 256 KB");
  }
  const body = new Uint8Array(await file.arrayBuffer());
  if (!JPEG_MAGIC.every((byte, index) => body[index] === byte)) {
    throw new Error("Avatar must be a JPEG");
  }

  const key = avatarKey(viewer.id);
  await putObject(key, body, "image/jpeg");
  try {
    await updateUser({ image: storageUrl(key) });
  } catch (error) {
    await deleteObject(key).catch(() => null);
    throw error;
  }
  await deleteAvatar(viewer);
};

export const removeAvatar = async (): Promise<void> => {
  const viewer = await requireViewer();
  await updateUser({ image: null });
  await deleteAvatar(viewer);
};
