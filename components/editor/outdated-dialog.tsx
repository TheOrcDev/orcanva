"use client";

import { useEffect, useTransition } from "react";

import { useEditor } from "@/components/editor/editor-store-context";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Spinner } from "@/components/ui/spinner";
import type { SaveStatus } from "@/lib/editor/store";

const SAVE_NOTE: Record<SaveStatus, string> = {
  error: "Your latest changes haven't reached the server yet.",
  saved: "Your changes are saved.",
  saving: "Saving your changes…",
  unsaved: "Saving your changes…",
};

// Shown once newer code takes over while this tab is open (see `outdated`
// in the store). The tab sends what it has, writes nothing more, and a
// reload brings the new version.
export const OutdatedDialog = ({ flush }: { flush: () => Promise<void> }) => {
  const outdated = useEditor((state) => state.outdated);
  const saveStatus = useEditor((state) => state.saveStatus);
  const [isReloading, startReloading] = useTransition();

  useEffect(() => {
    if (outdated) {
      flush().catch(() => null);
    }
  }, [outdated, flush]);

  const reload = () => {
    startReloading(async () => {
      await flush();
      window.location.reload();
    });
  };

  return (
    <AlertDialog open={outdated}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Reload to keep editing</AlertDialogTitle>
          <AlertDialogDescription>
            Orcanva was updated while this design was open, so this tab stops
            here. {SAVE_NOTE[saveStatus]}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction disabled={isReloading} onClick={reload}>
            {isReloading ? <Spinner data-icon="inline-start" /> : null}
            Reload
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
