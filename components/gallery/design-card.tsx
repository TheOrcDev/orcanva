"use client";

import {
  RiDeleteBinLine,
  RiEditLine,
  RiFileCopy2Line,
  RiGlobalLine,
  RiImageLine,
  RiLockLine,
  RiMoreLine,
  RiPencilLine,
  RiUserLine,
} from "@remixicon/react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import type { FormEvent } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import {
  deleteDesign,
  duplicateDesign,
  renameDesign,
  setDesignVisibility,
} from "@/lib/actions/designs";
import type { Visibility } from "@/lib/auth/access";
import { signInUrl } from "@/lib/auth/redirect";
import { STUDIO_PATH } from "@/lib/routes";

export interface DesignCardProps {
  id: string;
  name: string;
  sizeLabel: string;
  editedLabel: string;
  thumbnailUrl: string | null;
  // Its preview shows the first page; a badge says how many there are
  pageCount: number;
  visibility: Visibility;
  ownerName: string | null;
  // The viewer owns it: rename, delete, and change visibility
  canManage: boolean;
  // Copies belong to an account, so guests are sent to sign in first
  signedIn: boolean;
}

export const DesignCard = ({
  id,
  name,
  sizeLabel,
  editedLabel,
  thumbnailUrl,
  pageCount,
  visibility,
  ownerName,
  canManage,
  signedIn,
}: DesignCardProps) => {
  const router = useRouter();
  const inputId = useId();
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [draftName, setDraftName] = useState(name);
  const [isPending, startTransition] = useTransition();
  const href = `/design/${id}`;

  const handleRename = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextName = draftName.trim();
    if (!nextName || nextName === name) {
      setRenameOpen(false);
      return;
    }
    startTransition(async () => {
      try {
        await renameDesign({ id, name: nextName });
        setRenameOpen(false);
      } catch {
        toast.add({ title: "Could not rename design", type: "error" });
      }
    });
  };

  const handleMakeCopy = () => {
    startTransition(async () => {
      try {
        const copy = await duplicateDesign(id);
        router.push(`/design/${copy.id}`);
      } catch {
        toast.add({ title: "Could not copy design", type: "error" });
      }
    });
  };

  const handleVisibility = () => {
    const next = visibility === "public" ? "private" : "public";
    startTransition(async () => {
      try {
        await setDesignVisibility({ id, visibility: next });
        toast.add({
          title:
            next === "public"
              ? `“${name}” is public: anyone can edit it`
              : `“${name}” is private`,
          type: "success",
        });
      } catch {
        toast.add({ title: "Could not change who can see it", type: "error" });
      }
    });
  };

  const handleDelete = () => {
    startTransition(async () => {
      try {
        await deleteDesign(id);
        setDeleteOpen(false);
        toast.add({ title: `Deleted “${name}”`, type: "success" });
      } catch {
        toast.add({ title: "Could not delete design", type: "error" });
      }
    });
  };

  return (
    <Card size="sm">
      <CardContent>
        <Link
          href={href}
          className="bg-muted relative flex aspect-video items-center justify-center overflow-hidden rounded-2xl"
          aria-label={`Open ${name}`}
        >
          {thumbnailUrl ? (
            <Image
              src={thumbnailUrl}
              alt={`Preview of ${name}`}
              fill
              unoptimized
              sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
              className="object-contain"
            />
          ) : (
            <RiImageLine className="text-muted-foreground" aria-hidden />
          )}
          {pageCount > 1 ? (
            <span className="absolute right-2 bottom-2">
              <Badge variant="secondary">{pageCount} pages</Badge>
            </span>
          ) : null}
        </Link>
      </CardContent>
      <CardHeader>
        <CardTitle>
          <Link href={href} className="block truncate">
            {name}
          </Link>
        </CardTitle>
        <CardDescription>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {/* Among everyone's public designs, mark the viewer's own */}
            {canManage && visibility === "public" ? (
              <Badge variant="secondary">
                <RiUserLine />
                Yours
              </Badge>
            ) : null}
            <span>
              {sizeLabel} · Edited {editedLabel}
              {!canManage && ownerName ? ` · by ${ownerName}` : null}
            </span>
          </span>
        </CardDescription>
        <CardAction>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Actions for ${name}`}
                />
              }
            >
              <RiMoreLine />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuGroup>
                <DropdownMenuItem render={<Link href={href} />}>
                  <RiEditLine />
                  Open
                </DropdownMenuItem>
                {signedIn ? (
                  <DropdownMenuItem
                    disabled={isPending}
                    onClick={handleMakeCopy}
                  >
                    <RiFileCopy2Line />
                    Make a copy
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem
                    render={<Link href={signInUrl(STUDIO_PATH)} />}
                  >
                    <RiFileCopy2Line />
                    Sign in to make a copy
                  </DropdownMenuItem>
                )}
                {canManage ? (
                  <>
                    <DropdownMenuItem
                      onClick={() => {
                        setDraftName(name);
                        setRenameOpen(true);
                      }}
                    >
                      <RiPencilLine />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={isPending}
                      onClick={handleVisibility}
                    >
                      {visibility === "public" ? (
                        <RiLockLine />
                      ) : (
                        <RiGlobalLine />
                      )}
                      {visibility === "public" ? "Make private" : "Make public"}
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuGroup>
              {canManage ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      variant="destructive"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <RiDeleteBinLine />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        </CardAction>
      </CardHeader>

      <Dialog open={renameOpen} onOpenChange={setRenameOpen}>
        <DialogContent>
          <form className="flex flex-col gap-6" onSubmit={handleRename}>
            <DialogHeader>
              <DialogTitle>Rename design</DialogTitle>
            </DialogHeader>
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor={inputId}>Name</FieldLabel>
                <Input
                  id={inputId}
                  value={draftName}
                  maxLength={120}
                  onChange={(event) => setDraftName(event.target.value)}
                />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Spinner data-icon="inline-start" /> : null}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the design and its preview. Uploaded images stay in
              your library.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isPending}
              onClick={handleDelete}
            >
              {isPending ? <Spinner data-icon="inline-start" /> : null}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};
