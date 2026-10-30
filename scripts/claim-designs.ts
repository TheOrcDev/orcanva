// Gives every design and upload made before accounts existed to one account.
// Usage: pnpm claim-designs <email>   (sign up with that email first)
//
// Visibility is left alone, so the old designs stay public.
import { neon } from "@neondatabase/serverless";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

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
    sql`UPDATE designs SET owner_id = ${user.id} WHERE owner_id IS NULL RETURNING id`,
    sql`UPDATE assets SET owner_id = ${user.id} WHERE owner_id IS NULL RETURNING id`,
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
