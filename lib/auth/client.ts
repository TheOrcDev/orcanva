"use client";

import { createAuthClient } from "@neon/auth/next";

// Talks to Neon Auth through this app's /api/auth route, so the session
// cookies are first-party
export const authClient = createAuthClient();

// A readable message from a failed auth call, which either throws an
// AuthHttpError or resolves with `{ error }` depending on the method
export const authErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error !== "object" || error === null) {
    return fallback;
  }
  const body = "error" in error ? error.error : null;
  if (typeof body === "object" && body !== null && "message" in body) {
    const { message } = body;
    if (typeof message === "string" && message) {
      return message;
    }
  }
  if ("message" in error && typeof error.message === "string") {
    return error.message || fallback;
  }
  return fallback;
};
