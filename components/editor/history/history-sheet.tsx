"use client";

import { RiDeleteBinLine, RiHistoryLine, RiImageLine } from "@remixicon/react";
import type Konva from "konva";
import Image from "next/image";
import { useId, useState } from "react";
import type { FormEvent } from "react";

import { usePageNodeRef } from "@/components/editor/canvas-context";
import {
  useEditor,
  useEditorStoreApi,
} from "@/components/editor/editor-store-context";
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
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/toast";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useVersionHistory } from "@/hooks/use-version-history";
import type { VersionHistory } from "@/hooks/use-version-history";
import { canManageHistory } from "@/lib/auth/access";
import type { DesignDocument } from "@/lib/document/schema";
import { selectDocument } from "@/lib/editor/store";
import { prepareForRender } from "@/lib/export/prepare";
import { renderThumbnail } from "@/lib/export/render-page";
import { cn } from "@/lib/utils";
import {
  deleteVersion,
  saveVersion,
  uploadVersionThumbnail,
} from "@/lib/versions/api";
import {
  formatVersionTime,
  versionByline,
  versionTitle,
} from "@/lib/versions/labels";
import { MAX_VERSION_NAME } from "@/lib/versions/schema";
import type { VersionSummary } from "@/lib/versions/schema";

const drawPicture = async (
  node: Konva.Group,
  document: DesignDocument,
  designId: string,
  versionId: string
) => {
  await prepareForRender(document);
  const picture = await renderThumbnail(node, document);
  await uploadVersionThumbnail(designId, versionId, picture);
};

// Names the design as it is now. This window's own edits go out first, so
// the version holds them, and its picture is drawn from the canvas, which
// shows the same state.
const SaveVersionForm = ({ onSaved }: { onSaved: () => void }) => {
  const store = useEditorStoreApi();
  const pageNodeRef = usePageNodeRef();
  const id = useId();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || saving) {
      return;
    }
    setSaving(true);
    try {
      const { designId, flushWrites } = store.getState();
      await flushWrites?.();
      const document = selectDocument(store.getState());
      const saved = await saveVersion(designId, trimmed);
      const node = pageNodeRef.current;
      // Without its picture, one is drawn when it's first previewed. A tab
      // that can't draw part of the design leaves that to another.
      if (node && store.getState().skippedElementIds.length === 0) {
        await drawPicture(node, document, designId, saved.id).catch(() => null);
      }
      setName("");
      toast.add({ title: `Saved “${trimmed}”`, type: "success" });
      onSaved();
    } catch (error) {
      toast.add({
        description: error instanceof Error ? error.message : undefined,
        title: "Couldn't save the version",
        type: "error",
      });
    }
    setSaving(false);
  };

  return (
    <Field>
      <FieldLabel htmlFor={`${id}-name`}>Save this version</FieldLabel>
      <form onSubmit={handleSubmit}>
        <InputGroup>
          <InputGroupInput
            id={`${id}-name`}
            autoComplete="off"
            maxLength={MAX_VERSION_NAME}
            placeholder="Final v2"
            value={name}
            disabled={saving}
            onChange={(event) => setName(event.target.value)}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupButton
              type="submit"
              variant="secondary"
              size="xs"
              disabled={saving || name.trim() === ""}
            >
              {saving ? <Spinner data-icon="inline-start" /> : null}
              Save
            </InputGroupButton>
          </InputGroupAddon>
        </InputGroup>
      </form>
      <FieldDescription>
        Named versions are kept until you delete them.
      </FieldDescription>
    </Field>
  );
};

const VersionRow = ({
  version,
  loadedAt,
  previewing,
  onPreview,
  onDelete,
}: {
  version: VersionSummary;
  loadedAt: Date;
  // It's the one shown in the preview
  previewing: boolean;
  onPreview: () => void;
  // The owner's: asks first, then deletes it
  onDelete?: () => void;
}) => {
  const title = versionTitle(version);
  const createdAt = new Date(version.createdAt);

  return (
    <li className="flex items-center gap-1">
      <button
        type="button"
        aria-current={previewing ? "true" : undefined}
        onClick={onPreview}
        className={cn(
          "hover:bg-muted focus-visible:ring-ring flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-2",
          previewing && "bg-muted"
        )}
      >
        <span className="bg-muted relative flex aspect-video w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg">
          {version.thumbnailUrl ? (
            <Image
              src={version.thumbnailUrl}
              alt=""
              fill
              unoptimized
              sizes="96px"
              className="object-contain"
            />
          ) : (
            <RiImageLine className="text-muted-foreground" aria-hidden />
          )}
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium">{title}</span>
          <span className="text-muted-foreground text-xs">
            {versionByline(version)} ·{" "}
            <time
              dateTime={version.createdAt}
              title={createdAt.toLocaleString()}
            >
              {formatVersionTime(createdAt, loadedAt)}
            </time>
          </span>
        </span>
      </button>
      {onDelete ? (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Delete ${title}, ${formatVersionTime(createdAt, loadedAt)}`}
          onClick={onDelete}
        >
          <RiDeleteBinLine />
        </Button>
      ) : null}
    </li>
  );
};

// Asks before deleting a version; deleting one can't be undone
const DeleteVersionDialog = ({
  version,
  onClose,
  onDeleted,
}: {
  version: VersionSummary | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) => {
  const store = useEditorStoreApi();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!version) {
      return;
    }
    setDeleting(true);
    try {
      await deleteVersion(store.getState().designId, version.id);
      onDeleted(version.id);
    } catch {
      toast.add({ title: "Couldn't delete the version", type: "error" });
    }
    setDeleting(false);
    onClose();
  };

  return (
    <AlertDialog
      open={version !== null}
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this version?</AlertDialogTitle>
          <AlertDialogDescription>
            “{version ? versionTitle(version) : ""}” goes for good, for
            everyone. The design itself doesn&apos;t change.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={deleting}
            onClick={() => handleDelete()}
          >
            {deleting ? <Spinner data-icon="inline-start" /> : null}
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

const VersionList = ({ history }: { history: VersionHistory }) => {
  const store = useEditorStoreApi();
  const isOwner = useEditor((state) => state.role === "owner");
  const previewVersionId = useEditor((state) => state.previewVersionId);
  const [deleting, setDeleting] = useState<VersionSummary | null>(null);

  if (history.status === "loading") {
    return (
      <div className="text-muted-foreground flex items-center justify-center gap-2 py-10 text-sm">
        <Spinner />
        Loading versions…
      </div>
    );
  }
  if (history.status === "error") {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Couldn&apos;t load the versions</EmptyTitle>
          <EmptyDescription>
            Check your connection and try again.
          </EmptyDescription>
        </EmptyHeader>
        <Button variant="outline" onClick={() => history.retry()}>
          Try again
        </Button>
      </Empty>
    );
  }
  if (history.versions.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>No versions yet</EmptyTitle>
          <EmptyDescription>
            The first one is kept as soon as someone edits the design.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }
  return (
    <>
      <ol aria-label="Versions, newest first" className="flex flex-col gap-1">
        {history.versions.map((version) => (
          <VersionRow
            key={version.id}
            version={version}
            loadedAt={history.loadedAt}
            previewing={version.id === previewVersionId}
            onPreview={() => store.getState().previewVersion(version.id)}
            onDelete={isOwner ? () => setDeleting(version) : undefined}
          />
        ))}
      </ol>
      <DeleteVersionDialog
        version={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={(id) => {
          if (store.getState().previewVersionId === id) {
            store.getState().previewVersion(null);
          }
          history.refresh().catch(() => null);
        }}
      />
      {history.hasMore ? (
        <Button
          variant="ghost"
          className="mt-2 w-full"
          disabled={history.loadingMore}
          onClick={() => history.loadMore()}
        >
          {history.loadingMore ? <Spinner data-icon="inline-start" /> : null}
          Show older versions
        </Button>
      ) : null}
    </>
  );
};

// The clock button in the toolbar and the sheet it opens: the design's
// versions, newest first, and a way to name the current one. Only for the
// owner and people it's shared with (canManageHistory).
export const HistorySheet = () => {
  const store = useEditorStoreApi();
  const role = useEditor((state) => state.role);
  const open = useEditor((state) => state.historyOpen);
  const history = useVersionHistory();

  if (!canManageHistory(role)) {
    return null;
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        // Ending a text edit commits it, so a version saved next holds it
        if (next) {
          store.getState().setEditingText(null);
        }
        store.getState().setHistoryOpen(next);
      }}
    >
      <Tooltip>
        <TooltipTrigger
          render={
            <SheetTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Version history"
                />
              }
            />
          }
        >
          <RiHistoryLine />
        </TooltipTrigger>
        <TooltipContent>Version history</TooltipContent>
      </Tooltip>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Version history</SheetTitle>
          <SheetDescription>
            A version is kept before each person&apos;s edits, and every 10
            minutes while someone edits. Only the owner and the people it&apos;s
            shared with can see them.
          </SheetDescription>
        </SheetHeader>
        <div className="px-6 pb-6">
          <SaveVersionForm onSaved={() => history.refresh()} />
        </div>
        <Separator />
        <div className="min-h-0 flex-1 overflow-y-auto p-3">
          <VersionList history={history} />
        </div>
      </SheetContent>
    </Sheet>
  );
};
