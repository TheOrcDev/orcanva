import "server-only";
import { z } from "zod";

const envSchema = z.object({
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_ENDPOINT_URL_S3: z.url(),
  AWS_REGION: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  DATABASE_URL: z.url(),
  STORAGE_BUCKET: z.string().min(1),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

// Parsed lazily so `next build` can import modules without a full env
export const getEnv = (): Env => {
  cached ??= envSchema.parse(process.env);
  return cached;
};
