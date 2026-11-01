import { RiArrowLeftLine } from "@remixicon/react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { UserMenu } from "@/components/auth/user-menu";
import { LogoMark } from "@/components/logo-mark";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { Button } from "@/components/ui/button";
import { signInUrl } from "@/lib/auth/redirect";
import { getViewer } from "@/lib/auth/server";
import { SETTINGS_PATH, STUDIO_PATH } from "@/lib/routes";

export const metadata: Metadata = { title: "Settings" };

const SettingsPage = async () => {
  const viewer = await getViewer();
  // Guests have no profile: sign in, then come straight back
  if (!viewer) {
    redirect(signInUrl(SETTINGS_PATH));
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="border-b">
        <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between gap-4 px-6">
          <Link href="/" className="flex items-center gap-2">
            <LogoMark className="size-5" />
            <span className="font-heading text-lg font-semibold">Orcanva</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button variant="ghost" render={<Link href={STUDIO_PATH} />}>
              <RiArrowLeftLine data-icon="inline-start" />
              Back to studio
            </Button>
            <UserMenu viewer={viewer} />
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 px-6 py-8">
        <div className="flex flex-col gap-1">
          <h1 className="font-heading text-2xl font-semibold">Settings</h1>
          <p className="text-muted-foreground text-sm">
            Your name and avatar, as others see them.
          </p>
        </div>
        <ProfileSettings
          viewer={{
            email: viewer.email,
            image: viewer.image,
            name: viewer.name,
          }}
        />
      </main>
    </div>
  );
};

export default SettingsPage;
