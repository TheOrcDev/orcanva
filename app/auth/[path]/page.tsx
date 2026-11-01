import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  ForgotPasswordForm,
  ResetPasswordForm,
  SignInForm,
  SignUpForm,
} from "@/components/auth/auth-forms";
import { LogoMark } from "@/components/logo-mark";
import { safeNext } from "@/lib/auth/redirect";
import { getViewer } from "@/lib/auth/server";
import { shareEmail } from "@/lib/sharing/invite";

const TITLES = {
  "forgot-password": "Forgot password",
  "reset-password": "New password",
  "sign-in": "Sign in",
  "sign-up": "Create account",
} as const;

type AuthView = keyof typeof TITLES;

const isAuthView = (path: string): path is AuthView =>
  Object.hasOwn(TITLES, path);

const firstParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export const generateMetadata = async (
  props: PageProps<"/auth/[path]">
): Promise<Metadata> => {
  const { path } = await props.params;
  return {
    robots: { index: false },
    title: isAuthView(path) ? TITLES[path] : "Not found",
  };
};

const AuthPage = async (props: PageProps<"/auth/[path]">) => {
  const { path } = await props.params;
  if (!isAuthView(path)) {
    notFound();
  }
  const searchParams = await props.searchParams;
  const next = safeNext(firstParam(searchParams.next));
  // Filled in from an invite link; anything else is left for them to type
  const email = shareEmail.safeParse(firstParam(searchParams.email)).data;

  // Already signed in: nothing to do here (a reset link still works)
  if (path !== "reset-password" && (await getViewer())) {
    redirect(next);
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-8 p-6">
      <Link href="/" className="flex items-center gap-2">
        <LogoMark className="size-5" />
        <span className="font-heading text-lg font-semibold">Orcanva</span>
      </Link>
      <div className="w-full max-w-sm">
        {path === "sign-in" ? <SignInForm next={next} email={email} /> : null}
        {path === "sign-up" ? <SignUpForm next={next} email={email} /> : null}
        {path === "forgot-password" ? <ForgotPasswordForm next={next} /> : null}
        {path === "reset-password" ? (
          <ResetPasswordForm token={firstParam(searchParams.token) ?? null} />
        ) : null}
      </div>
    </main>
  );
};

export default AuthPage;
