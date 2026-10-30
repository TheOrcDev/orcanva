"use client";

import Link from "next/link";

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

// Shown when the server stops letting this person at the design: its owner
// made it private or deleted it while they were editing
export const AccessLostDialog = () => {
  const accessLost = useEditor((state) => state.accessLost);

  return (
    <AlertDialog open={accessLost}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            This design isn&apos;t available anymore
          </AlertDialogTitle>
          <AlertDialogDescription>
            Its owner made it private or deleted it, so your latest changes
            weren&apos;t saved.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction render={<Link href="/" />}>
            Back to designs
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
