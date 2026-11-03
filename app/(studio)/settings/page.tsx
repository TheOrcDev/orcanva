import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { BrandKitSettings } from "@/components/settings/brand-kit-settings";
import { ProfileSettings } from "@/components/settings/profile-settings";
import { PageBody, PageHeader } from "@/components/studio/page-header";
import { signInUrl } from "@/lib/auth/redirect";
import { getViewer } from "@/lib/auth/server";
import { listLibrary } from "@/lib/db/queries/assets";
import { getBrandKit } from "@/lib/db/queries/brand-kit";
import { SETTINGS_PATH } from "@/lib/routes";

export const metadata: Metadata = { title: "Settings" };

const SettingsPage = async () => {
  const viewer = await getViewer();
  // Guests have no profile: sign in, then come straight back
  if (!viewer) {
    redirect(signInUrl(SETTINGS_PATH));
  }
  const [kit, library] = await Promise.all([
    getBrandKit(viewer.id),
    listLibrary(viewer.id),
  ]);

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
        <section
          aria-labelledby="brand-kit-heading"
          className="flex flex-col gap-6"
        >
          <div className="flex flex-col gap-1">
            <h2
              id="brand-kit-heading"
              className="font-heading text-lg font-semibold"
            >
              Brand kit
            </h2>
            <p className="text-muted-foreground text-sm">
              Colors, fonts and logos you use again and again, at hand in every
              design.
            </p>
          </div>
          <BrandKitSettings initialKit={kit} library={library} />
        </section>
      </PageBody>
    </>
  );
};

export default SettingsPage;
