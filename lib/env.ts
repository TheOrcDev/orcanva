import "server-only";
import { z } from "zod";

const envSchema = z.object({
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_ENDPOINT_URL_S3: z.url(),
  AWS_REGION: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  DATABASE_URL: z.url(),
  // Neon Auth (Managed Better Auth) for this branch, and the key that signs
  // the session cache cookie
  NEON_AUTH_BASE_URL: z.url(),
  NEON_AUTH_COOKIE_SECRET: z.string().min(32),
  // Optional: without Realtime the editor still saves, just single-player
  NEON_REALTIME_SECRET: z.string().min(1).optional(),
  NEON_REALTIME_URL: z.url().optional(),
  STORAGE_BUCKET: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

// Parsed lazily so `next build` can import modules without a full env
export const getEnv = (): Env => {
  cached ??= envSchema.parse(process.env);
  return cached;
};
