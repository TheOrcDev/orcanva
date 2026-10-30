"use client";

import {
  RiDeleteBinLine,
  RiEditLine,
  RiImageLine,
  RiMoreLine,
  RiPencilLine,
} from "@remixicon/react";
import Image from "next/image";
import Link from "next/link";
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
import { deleteDesign, renameDesign } from "@/lib/actions/designs";

export interface DesignCardProps {
  id: string;
  name: string;
  sizeLabel: string;
  editedLabel: string;
  thumbnailUrl: string | null;
}

export const DesignCard = ({
  id,
  name,
  sizeLabel,
  editedLabel,
  thumbnailUrl,
}: DesignCardProps) => {
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
        </Link>
      </CardContent>
      <CardHeader>
        <CardTitle>
          <Link href={href} className="block truncate">
            {name}
          </Link>
        </CardTitle>
        <CardDescription>
          {sizeLabel} · Edited {editedLabel}
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
                <DropdownMenuItem
                  onClick={() => {
                    setDraftName(name);
                    setRenameOpen(true);
                  }}
                >
                  <RiPencilLine />
                  Rename
                </DropdownMenuItem>
              </DropdownMenuGroup>
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
