"use client";

import { RiErrorWarningLine, RiGoogleFill } from "@remixicon/react";
import Link from "next/link";
import { useId, useState, useTransition } from "react";
import type { FormEvent, ReactNode } from "react";

import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authClient, authErrorMessage } from "@/lib/auth/client";
import { MAX_PROFILE_NAME } from "@/lib/collab/identity";

const MIN_PASSWORD_LENGTH = 8;

const absolute = (path: string) => new URL(path, window.location.origin).href;

// A full page load, so live queries and presence restart as the new person
const enter = (next: string) => window.location.assign(next);

const field = (data: FormData, name: string) => {
  const value = data.get(name);
  return typeof value === "string" ? value : "";
};

const withNext = (path: string, next: string) =>
  next === "/" ? path : `${path}?next=${encodeURIComponent(next)}`;

// Runs an auth call, which reports failure by throwing or by resolving with
// `{ error }`, and keeps its message for the form
const useAuthAction = () => {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (
    fallback: string,
    action: () => Promise<{ error?: unknown }>,
    onSuccess: () => void
  ) => {
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        if (result.error) {
          setError(authErrorMessage(result.error, fallback));
          return;
        }
        onSuccess();
      } catch (error_) {
        setError(authErrorMessage(error_, fallback));
      }
    });
  };

  return { error, isPending, run };
};

const AuthView = ({
  title,
  description,
  error,
  children,
}: {
  title: string;
  description: string;
  error: string | null;
  children: ReactNode;
}) => (
  <div className="flex flex-col gap-6">
    <div className="flex flex-col gap-1 text-center">
      <h1 className="font-heading text-2xl font-semibold">{title}</h1>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
    {error ? (
      <Alert variant="destructive">
        <RiErrorWarningLine />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    ) : null}
    {children}
  </div>
);

const SubmitButton = ({
  isPending,
  children,
}: {
  isPending: boolean;
  children: ReactNode;
}) => (
  <Button type="submit" disabled={isPending}>
    {isPending ? <Spinner data-icon="inline-start" /> : null}
    {children}
  </Button>
);

const GoogleButton = ({
  next,
  disabled,
  onError,
}: {
  next: string;
  disabled: boolean;
  onError: (message: string) => void;
}) => {
  const [isPending, startTransition] = useTransition();

  const handleClick = () => {
    startTransition(async () => {
      try {
        const { error } = await authClient.signIn.social({
          callbackURL: absolute(next),
          errorCallbackURL: absolute(withNext("/auth/sign-in", next)),
          provider: "google",
        });
        if (error) {
          onError(authErrorMessage(error, "Couldn't reach Google"));
        }
      } catch (error) {
        onError(authErrorMessage(error, "Couldn't reach Google"));
      }
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      disabled={disabled || isPending}
      onClick={handleClick}
    >
      {isPending ? (
        <Spinner data-icon="inline-start" />
      ) : (
        <RiGoogleFill data-icon="inline-start" />
      )}
      Continue with Google
    </Button>
  );
};

export const SignInForm = ({ next }: { next: string }) => {
  const id = useId();
  const { error, isPending, run } = useAuthAction();
  const [googleError, setGoogleError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setGoogleError(null);
    run(
      "Couldn't sign you in",
      () =>
        authClient.signIn.email({
          email: field(data, "email"),
          password: field(data, "password"),
        }),
      () => enter(next)
    );
  };

  return (
    <AuthView
      title="Welcome back"
      description="Sign in to see your designs"
      error={error ?? googleError}
    >
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Field>
            <GoogleButton
              next={next}
              disabled={isPending}
              onError={setGoogleError}
            />
          </Field>
          <FieldSeparator>Or with email</FieldSeparator>
          <Field>
            <FieldLabel htmlFor={`${id}-email`}>Email</FieldLabel>
            <Input
              id={`${id}-email`}
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </Field>
          <Field>
            <div className="flex items-center justify-between gap-2">
              <FieldLabel htmlFor={`${id}-password`}>Password</FieldLabel>
              <Link
                href={withNext("/auth/forgot-password", next)}
                className="text-muted-foreground text-sm underline-offset-4 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id={`${id}-password`}
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </Field>
          <Field>
            <SubmitButton isPending={isPending}>Sign in</SubmitButton>
            <FieldDescription className="text-center">
              No account yet?{" "}
              <Link href={withNext("/auth/sign-up", next)}>Create one</Link>
            </FieldDescription>
          </Field>
        </FieldGroup>
      </form>
    </AuthView>
  );
};

export const SignUpForm = ({ next }: { next: string }) => {
  const id = useId();
  const { error, isPending, run } = useAuthAction();
  const [googleError, setGoogleError] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setGoogleError(null);
    run(
      "Couldn't create your account",
      () =>
        authClient.signUp.email({
          email: field(data, "email"),
          name: field(data, "name").trim(),
          password: field(data, "password"),
        }),
      () => enter(next)
    );
  };

  return (
    <AuthView
      title="Create your account"
      description="Keep private designs and your own uploads"
      error={error ?? googleError}
    >
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Field>
            <GoogleButton
              next={next}
              disabled={isPending}
              onError={setGoogleError}
            />
          </Field>
          <FieldSeparator>Or with email</FieldSeparator>
          <Field>
            <FieldLabel htmlFor={`${id}-name`}>Name</FieldLabel>
            <Input
              id={`${id}-name`}
              name="name"
              autoComplete="name"
              maxLength={MAX_PROFILE_NAME}
              required
            />
            <FieldDescription>
              Others see it on designs you edit together.
            </FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-email`}>Email</FieldLabel>
            <Input
              id={`${id}-email`}
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-password`}>Password</FieldLabel>
            <Input
              id={`${id}-password`}
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
            <FieldDescription>
              At least {MIN_PASSWORD_LENGTH} characters.
            </FieldDescription>
          </Field>
          <Field>
            <SubmitButton isPending={isPending}>Create account</SubmitButton>
            <FieldDescription className="text-center">
              Already have an account?{" "}
              <Link href={withNext("/auth/sign-in", next)}>Sign in</Link>
            </FieldDescription>
          </Field>
        </FieldGroup>
      </form>
    </AuthView>
  );
};

export const ForgotPasswordForm = ({ next }: { next: string }) => {
  const id = useId();
  const { error, isPending, run } = useAuthAction();
  const [sentTo, setSentTo] = useState<string | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = field(new FormData(event.currentTarget), "email");
    run(
      "Couldn't send the reset email",
      () =>
        authClient.requestPasswordReset({
          email,
          redirectTo: absolute("/auth/reset-password"),
        }),
      () => setSentTo(email)
    );
  };

  if (sentTo) {
    return (
      <AuthView
        title="Check your email"
        description={`If ${sentTo} has an account, a link to choose a new password is on its way.`}
        error={null}
      >
        <Button
          variant="outline"
          render={<Link href={withNext("/auth/sign-in", next)} />}
        >
          Back to sign in
        </Button>
      </AuthView>
    );
  }

  return (
    <AuthView
      title="Forgot your password?"
      description="We'll email you a link to choose a new one"
      error={error}
    >
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${id}-email`}>Email</FieldLabel>
            <Input
              id={`${id}-email`}
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </Field>
          <Field>
            <SubmitButton isPending={isPending}>Send reset link</SubmitButton>
            <FieldDescription className="text-center">
              Remembered it?{" "}
              <Link href={withNext("/auth/sign-in", next)}>Sign in</Link>
            </FieldDescription>
          </Field>
        </FieldGroup>
      </form>
    </AuthView>
  );
};

export const ResetPasswordForm = ({ token }: { token: string | null }) => {
  const id = useId();
  const { error, isPending, run } = useAuthAction();

  if (!token) {
    return (
      <AuthView
        title="This link doesn't work"
        description="It may have expired or been used already. Ask for a new one."
        error={null}
      >
        <Button render={<Link href="/auth/forgot-password" />}>
          Send a new link
        </Button>
      </AuthView>
    );
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const newPassword = field(new FormData(event.currentTarget), "password");
    run(
      "Couldn't change your password",
      () => authClient.resetPassword({ newPassword, token }),
      () => window.location.assign("/auth/sign-in?reset=1")
    );
  };

  return (
    <AuthView
      title="Choose a new password"
      description="You'll sign in with it from now on"
      error={error}
    >
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor={`${id}-password`}>New password</FieldLabel>
            <Input
              id={`${id}-password`}
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              required
            />
            <FieldDescription>
              At least {MIN_PASSWORD_LENGTH} characters.
            </FieldDescription>
          </Field>
          <Field>
            <SubmitButton isPending={isPending}>Save password</SubmitButton>
          </Field>
        </FieldGroup>
      </form>
    </AuthView>
  );
};
