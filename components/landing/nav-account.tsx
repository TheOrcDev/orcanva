"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { UserMenu } from "@/components/auth/user-menu";
import { buttonVariants } from "@/components/ui/button";
import { authClient } from "@/lib/auth/client";
import { signInUrl } from "@/lib/auth/redirect";
import { STUDIO_PATH } from "@/lib/routes";

// Read in the browser so the marketing pages stay static: "Sign in" for
// guests, the account menu once a session turns up
export const NavAccount = () => {
  const { data, isPending } = authClient.useSession();
  const user = data?.user;
  // Signing out leaves you on this page, as a guest
  const pathname = usePathname();

  if (user) {
    return (
      <UserMenu
        large
        signOutTo={pathname}
        viewer={{
          email: user.email,
          image: user.image ?? null,
          name: user.name,
        }}
      />
    );
  }

  // Nothing while the session loads, so a signed-in visitor never sees
  // "Sign in" flash before their avatar
  if (isPending) {
    return null;
  }

  return (
    <Link
      href={signInUrl(STUDIO_PATH)}
      className={buttonVariants({
        className: "hidden sm:inline-flex",
        size: "lg",
        variant: "outline",
      })}
    >
      Sign in
    </Link>
  );
};
