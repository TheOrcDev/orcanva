import "server-only";
import { sql } from "drizzle-orm";
import type { SQL } from "drizzle-orm";
import { cache } from "react";

import { authUsers } from "@/lib/db/auth-schema";
import { getDb } from "@/lib/db/client";

// Admins moderate what everyone can see (see canDeleteDesign). An admin is
// an account whose Neon Auth role includes "admin" and that isn't banned;
// `pnpm make-admin <email>` grants it. Read from the table rather than the
// session, whose cached copy lags by up to five minutes, so taking it away
// counts at once.
export const isAdminSql = (viewerId: string): SQL =>
  sql`EXISTS (SELECT 1 FROM ${authUsers} WHERE ${authUsers.id} = ${viewerId} AND 'admin' = ANY(string_to_array(${authUsers.role}, ',')) AND ${authUsers.banned} IS NOT TRUE)`;

export const isAdmin = cache(
  async (viewerId: string | null): Promise<boolean> => {
    if (!viewerId) {
      return false;
    }
    const result = await getDb().execute<{ admin: boolean }>(
      sql`SELECT ${isAdminSql(viewerId)} AS admin`
    );
    return result.rows[0]?.admin === true;
  }
);
