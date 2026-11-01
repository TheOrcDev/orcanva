"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  MY_PUBLIC_DESIGNS_PATH,
  OWNER_MINE,
  PUBLIC_DESIGNS_PATH,
} from "@/lib/routes";

// Everyone's public designs, or only the viewer's. Kept in the URL, so a
// reload or a shared link shows the same list.
export const PublicFilter = ({ onlyMine }: { onlyMine: boolean }) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      {isPending ? <Spinner /> : null}
      <ToggleGroup
        variant="outline"
        size="sm"
        aria-label="Whose public designs"
        value={[onlyMine ? OWNER_MINE : "everyone"]}
        onValueChange={(value) => {
          // Pressing the current option again unpresses it: keep it
          const [next] = value;
          if (!next) {
            return;
          }
          startTransition(() => {
            router.replace(
              next === OWNER_MINE ? MY_PUBLIC_DESIGNS_PATH : PUBLIC_DESIGNS_PATH
            );
          });
        }}
      >
        <ToggleGroupItem value="everyone">Everyone</ToggleGroupItem>
        <ToggleGroupItem value={OWNER_MINE}>Mine</ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
};
