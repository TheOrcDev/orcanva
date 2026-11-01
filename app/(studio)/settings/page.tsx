import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ProfileSettings } from "@/components/settings/profile-settings";
import { PageBody, PageHeader } from "@/components/studio/page-header";
import { signInUrl } from "@/lib/auth/redirect";
import { getViewer } from "@/lib/auth/server";
import { SETTINGS_PATH } from "@/lib/routes";

export const metadata: Metadata = { title: "Settings" };

const SettingsPage = async () => {
  const viewer = await getViewer();
  // Guests have no profile: sign in, then come straight back
  if (!viewer) {
    redirect(signInUrl(SETTINGS_PATH));
  }

  return (
    <>
      <PageHeader title="Settings" />
      <PageBody className="max-w-2xl gap-8">
        <p className="text-muted-foreground text-sm">
          Your name and avatar, as others see them.
        </p>
        <ProfileSettings
          viewer={{
            email: viewer.email,
            image: viewer.image,
            name: viewer.name,
          }}
        />
      </PageBody>
    </>
  );
};

export default SettingsPage;
