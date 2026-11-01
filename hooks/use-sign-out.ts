"use client";

import { useTransition } from "react";

import { toast } from "@/components/ui/toast";
import { authClient } from "@/lib/auth/client";
import { STUDIO_PATH } from "@/lib/routes";

// Signs out, then reloads the studio as a guest
export const useSignOut = () => {
  const [isPending, startTransition] = useTransition();

  const signOut = () => {
    startTransition(async () => {
      try {
        await authClient.signOut();
        // A full load, so nothing of this account stays on screen
        window.location.assign(STUDIO_PATH);
      } catch {
        toast.add({ title: "Couldn't sign you out", type: "error" });
      }
    });
  };

  return { isPending, signOut };
};
