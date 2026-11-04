// Gives every design and upload made before accounts existed to one account.
// Usage: pnpm claim-designs <email>   (sign up with that email first)
//
// Visibility is left alone, so the old designs stay public. Designs guests
// made since they could (GUEST_DESIGNS_SINCE) have no owner either, and stay
// that way.
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

// When guests started making public designs of their own
const GUEST_DESIGNS_SINCE = "2026-11-04T10:00:00Z";

const log = (message: string) => {
  process.stdout.write(`${message}\n`);
};

const main = async () => {
  const email = process.argv[2]?.trim().toLowerCase();
  const url = process.env.DATABASE_URL;
  if (!email) {
    throw new Error("Usage: pnpm claim-designs <email>");
  }
  if (!url) {
    throw new Error("DATABASE_URL is missing; add it to .env.local");
  }

  const sql = neon(url);
  const [user] = await sql`
    SELECT id, name FROM neon_auth."user" WHERE lower(email) = ${email}
  `;
  if (!user) {
    throw new Error(`No account for ${email}; sign up with it first`);
  }

  const [designs, assets] = await sql.transaction([
    sql`UPDATE designs SET owner_id = ${user.id} WHERE owner_id IS NULL AND created_at < ${GUEST_DESIGNS_SINCE} RETURNING id`,
    // Uploads only: template images have no owner and must stay that way
    sql`UPDATE assets SET owner_id = ${user.id} WHERE owner_id IS NULL AND origin = 'upload' RETURNING id`,
  ]);
  log(
    `${user.name} (${email}) now owns ${designs?.length ?? 0} designs and ${assets?.length ?? 0} uploads`
  );
};

try {
  await main();
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
}
