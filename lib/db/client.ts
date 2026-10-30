import "server-only";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import type { NeonHttpDatabase } from "drizzle-orm/neon-http";

import { getEnv } from "@/lib/env";

let instance: NeonHttpDatabase | undefined;

export const getDb = (): NeonHttpDatabase => {
  instance ??= drizzle({ client: neon(getEnv().DATABASE_URL) });
  return instance;
};
